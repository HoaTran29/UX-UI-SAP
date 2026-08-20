sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Fragment"
], function (Controller, JSONModel, Filter, FilterOperator, Fragment) {
    "use strict";

    return Controller.extend("com.app.zu26g13.app.controller.Dashboard", {
        onInit: function () {
            // khởi tạo model chứa dữ liệu kpi 
            var oKpiModel = new JSONModel({
                totalEmp: 0,
                totalOT: 0,
                pendingDisputes: 0,
                totalScheduled: 0   
            });
            this.getView().setModel(oKpiModel, "kpi");

            // model chứa danh sách phòng ban để map id sang tên
            var oDeptLookupModel = new JSONModel({});
            this.getView().setModel(oDeptLookupModel, "deptLookup");

            // gắn sự kiện khi load vào trang dashboard
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("dashboard").attachPatternMatched(this._loadRealKpiData, this);
            oRouter.getRoute("dashboard").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function () {
            // tự động chạy tìm kiếm mặc định khi vừa vào trang
            if (this.onSearch) {
                this.onSearch();
            }
        },

        _getI18nText: function (sKey) {
            return this.getView().getModel("i18n").getResourceBundle().getText(sKey);
        },

        _loadRealKpiData: function () {
            var oModel = this.getOwnerComponent().getModel();
            var oKpiModel = this.getView().getModel("kpi");
            var oDeptLookupModel = this.getView().getModel("deptLookup");

            // Ngày hiện tại
            var oDate = new Date();
            var y = oDate.getFullYear();
            var m = oDate.getMonth();
            var d = oDate.getDate();

            // Tính ngày đầu/cuối của nguyên THÁNG (dùng để tính tổng OT)
            var dStart = new Date(Date.UTC(y, m, 1, 0, 0, 0));
            var dEnd = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59));

            // Tính giờ bắt đầu/kết thúc của HÔM NAY (dùng để đếm nhân sự đi làm)
            var dTodayStart = new Date(Date.UTC(y, m, d, 0, 0, 0));
            var dTodayEnd = new Date(Date.UTC(y, m, d, 23, 59, 59));

            // 1. Đếm tổng số nhân sự (đọc từ bảng Employee)
            oModel.read("/Employee", {
                success: function (oData) {
                    // Cứ có bao nhiêu nhân viên trong Database là đếm hết
                    oKpiModel.setProperty("/totalEmp", oData.results.length);
                }
            });

            // 2. Đếm số nhân viên CÓ LỊCH LÀM (Shift Schedule) hôm nay
            oModel.read("/EmpShift", {
                filters: [new Filter("WorkDate", FilterOperator.BT, dTodayStart, dTodayEnd)],
                success: function (oData) {
                    oKpiModel.setProperty("/totalScheduled", oData.results.length);
                }
            });

            // 3. Đếm số khiếu nại đang chờ duyệt
            oModel.read("/Dispute", {
                filters: [new Filter("Status", FilterOperator.EQ, "PENDING")],
                success: function (oData) {
                    oKpiModel.setProperty("/pendingDisputes", oData.results.length);
                }
            });

            // 4. Tính tổng giờ OT trong tháng
            oModel.read("/Timesheet", {
                filters: [new Filter("WorkDate", FilterOperator.BT, dStart, dEnd)],
                success: function (oData) {
                    var totalOT = 0;
                    oData.results.forEach(function (item) {
                        if (item.OtHours) {
                            totalOT += parseFloat(item.OtHours);
                        }
                    });
                    oKpiModel.setProperty("/totalOT", totalOT.toFixed(1));
                }
            });

            // 5. Lấy danh sách phòng ban để map ID ra Tên
            oModel.read("/Department", {
                success: function (oData) {
                    var oMap = {};
                    if (oData.results) {
                        oData.results.forEach(function (oDept) {
                            oMap[oDept.DeptId] = oDept.DeptName;
                        });
                    }
                    oDeptLookupModel.setData(oMap);
                }
            });
        },

        // =========================================================
        // popup chọn nhân viên (employee value help)
        // =========================================================
        onEmpValueHelpRequest: function (oEvent) {
            var oView = this.getView();
            this._oInputEmp = oEvent.getSource();

            // tải popup nếu chưa có
            if (!this._pEmpValueHelpDialog) {
                this._pEmpValueHelpDialog = Fragment.load({
                    id: oView.getId(),
                    name: "com.app.zu26g13.app.view.EmployeeValueHelp",
                    controller: this
                }).then(function (oPopover) {
                    oView.addDependent(oPopover);
                    return oPopover;
                });
            }
            this._pEmpValueHelpDialog.then(function (oPopover) {
                // xóa bộ lọc cũ trước khi mở
                var oList = this.byId("empValueHelpList");
                if (oList) {
                    oList.getBinding("items").filter([]);
                    oList.removeSelections(true);
                }
                oPopover.openBy(this._oInputEmp);
            }.bind(this));
        },

        onEmployeeValueHelpSearch: function (oEvent) {
            var sValue = oEvent.getParameter("value") || oEvent.getParameter("newValue") || "";
            var oListBinding = this.byId("empValueHelpList").getBinding("items");

            if (!sValue) {
                oListBinding.filter([]);
            } else {
                // tìm theo tên hoặc mã nhân viên
                var oFilterName = new Filter("Ename", FilterOperator.Contains, sValue);
                var oFilterId = new Filter("Pernr", FilterOperator.EQ, sValue);
                oListBinding.filter([new Filter({ filters: [oFilterName, oFilterId], and: false })]);
            }
        },

        onEmployeeValueHelpConfirm: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("listItem");
            if (oSelectedItem && this._oInputEmp) {
                this._oInputEmp.setValue(oSelectedItem.getDescription());
                if (this.onSearch) this.onSearch(); // tự động tìm kiếm luôn cho tiện
                this._pEmpValueHelpDialog.then(function (oPopover) { oPopover.close(); });
            }
        },

        onEmployeeValueHelpCancel: function () {
            if (this._pEmpValueHelpDialog) {
                this._pEmpValueHelpDialog.then(function (oPopover) { oPopover.close(); });
            }
        },

        // =========================================================
        // popup chọn phòng ban (department value help)
        // =========================================================
        onDeptValueHelpRequest: function (oEvent) {
            var oView = this.getView();
            this._oInputDept = oEvent.getSource();

            if (!this._pDeptValueHelpDialog) {
                this._pDeptValueHelpDialog = Fragment.load({
                    id: oView.getId(),
                    name: "com.app.zu26g13.app.view.DepartmentValueHelp",
                    controller: this
                }).then(function (oPopover) {
                    oView.addDependent(oPopover);
                    return oPopover;
                });
            }
            this._pDeptValueHelpDialog.then(function (oPopover) {
                var oList = this.byId("deptValueHelpList");
                if (oList) {
                    oList.getBinding("items").filter([]);
                    oList.removeSelections(true);
                }
                oPopover.openBy(this._oInputDept);
            }.bind(this));
        },

        onDeptValueHelpSearch: function (oEvent) {
            var sValue = oEvent.getParameter("value") || oEvent.getParameter("newValue") || "";
            var oListBinding = this.byId("deptValueHelpList").getBinding("items");

            if (!sValue) {
                oListBinding.filter([]);
            } else {
                var oFilterName = new Filter("DeptName", FilterOperator.Contains, sValue);
                var oFilterId = new Filter("DeptId", FilterOperator.Contains, sValue);
                oListBinding.filter([new Filter({ filters: [oFilterName, oFilterId], and: false })]);
            }
        },

        onDeptValueHelpConfirm: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("listItem");
            if (oSelectedItem && this._oInputDept) {
                this._oInputDept.setValue(oSelectedItem.getDescription());
                if (this.onSearch) this.onSearch();
                this._pDeptValueHelpDialog.then(function (oPopover) { oPopover.close(); });
            }
        },

        onDeptValueHelpCancel: function () {
            if (this._pDeptValueHelpDialog) {
                this._pDeptValueHelpDialog.then(function (oPopover) { oPopover.close(); });
            }
        },

        // =========================================================
        // điều hướng và bộ lọc (navigation & filtering)
        // =========================================================
        onGoToDispute: function () {
            this.getOwnerComponent().getRouter().navTo("dispute");
        },

        onNavToSchedule: function () {
            this.getOwnerComponent().getRouter().navTo("schedule");
        },

        onNavToEmployee: function () {
            this.getOwnerComponent().getRouter().navTo("employeeConfig");
        },

        onNavToMonthlyReport: function () {
            this.getOwnerComponent().getRouter().navTo("monthlyReport");
        },

        onFilterStatus: function (oEvent) {
            var sKey = oEvent.getParameter("item").getKey();
            var aFilters = [];

            if (sKey !== "ALL") {
                if (sKey === "ERROR") {
                    // gom chung đi trễ về sớm thành 1 tab lỗi
                    var oFilterLate = new Filter("Status", FilterOperator.EQ, "LATE_IN");
                    var oFilterEarly = new Filter("Status", FilterOperator.EQ, "EARLY_OUT");
                    aFilters.push(new Filter({ filters: [oFilterLate, oFilterEarly], and: false }));
                } else {
                    aFilters.push(new Filter("Status", FilterOperator.EQ, sKey));
                }
            }

            this.byId("timesheetTable").getBinding("items").filter(aFilters);
        },

        onSearch: function () {
            var aFilters = [];
            var sEmp = this.byId("fltEmp").getValue();
            var sDept = this.byId("fltDept").getValue();
            var oDate = this.byId("fltDate").getDateValue();

            if (sEmp) aFilters.push(new Filter("Pernr", FilterOperator.EQ, sEmp));
            if (sDept) aFilters.push(new Filter("DeptId", FilterOperator.EQ, sDept));

            // ép ngày về utc để không bị lệch múi giờ khi gọi backend
            if (oDate) {
                var y = oDate.getFullYear();
                var m = oDate.getMonth();
                var d = oDate.getDate();

                var dStart = new Date(Date.UTC(y, m, d, 0, 0, 0));
                var dEnd = new Date(Date.UTC(y, m, d, 23, 59, 59));

                aFilters.push(new Filter("WorkDate", FilterOperator.BT, dStart, dEnd));
            }

            this.byId("timesheetTable").getBinding("items").filter(aFilters);
        },

        onClear: function () {
            this.byId("fltEmp").setValue("");
            this.byId("fltDept").setValue("");
            this.byId("fltDate").setDateValue(null);
            this.byId("timesheetTable").getBinding("items").filter([]);
        },

        // =========================================================
        // format dữ liệu hiển thị (formatters)
        // =========================================================
        formatTimeDisplay: function (oTime, sWorkDate, sStatus) {
            // fix tạm logic nếu backend đẩy status nhầm vào cột date
            if (sWorkDate === 'ABSENT' || sWorkDate === 'LEAVE' || sWorkDate === 'COMPLETED' || sWorkDate === 'CHECK_IN') {
                sStatus = sWorkDate;
            }

            if (sStatus === "ABSENT" || sStatus === "LEAVE") {
                return "N/A";
            }

            if (sStatus === "CHECK_IN" && oTime && (oTime.ms === 0 || oTime === "PT00H00M00S")) {
                return "N/A";
            }

            if (!oTime) return "";

            var timeFormat = sap.ui.core.format.DateFormat.getTimeInstance({
                pattern: "HH:mm:ss",
                UTC: true
            });
            
            if (oTime.ms !== undefined) {
                return timeFormat.format(new Date(oTime.ms));
            } 
            
            return oTime;
        }
    });
});