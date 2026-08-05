sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/export/Spreadsheet",
    "sap/ui/core/Fragment"
], function (Controller, JSONModel, Filter, FilterOperator, Spreadsheet, Fragment) {
    "use strict";

    return Controller.extend("com.app.zu26g13.app.controller.Dashboard", {
        onInit: function () {
            var oKpiModel = new sap.ui.model.json.JSONModel({
                totalEmp: 0,
                totalOT: 0,
                pendingDisputes: 0
            });
            this.getView().setModel(oKpiModel, "kpi");

            var oDeptLookupModel = new sap.ui.model.json.JSONModel({});
            this.getView().setModel(oDeptLookupModel, "deptLookup");

            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("dashboard").attachPatternMatched(this._loadRealKpiData, this);

            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("dashboard").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function () {
            if (this.onSearch) {
                this.onSearch();
            }
        },

        _loadRealKpiData: function () {
            var oModel = this.getOwnerComponent().getModel();
            var oKpiModel = this.getView().getModel("kpi");
            var oDeptLookupModel = this.getView().getModel("deptLookup");
            var oDate = new Date();
            var y = oDate.getFullYear();
            var m = oDate.getMonth();
            var dStart = new Date(Date.UTC(y, m, 1, 0, 0, 0));
            var dEnd = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59));

            oModel.read("/Employee", {
                success: function (oData) {
                    oKpiModel.setProperty("/totalEmp", oData.results.length);
                }
            });

            oModel.read("/Dispute", {
                filters: [new Filter("Status", FilterOperator.EQ, "PENDING")],
                success: function (oData) {
                    oKpiModel.setProperty("/pendingDisputes", oData.results.length);
                }
            });

            oModel.read("/Timesheet", {
                // Lọc đúng dữ liệu của tháng này
                filters: [new sap.ui.model.Filter("WorkDate", sap.ui.model.FilterOperator.BT, dStart, dEnd)],
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
        // HỆ SINH THÁI SEARCH HELP (VALUE HELP) DÙNG CHUNG (DẠNG POPOVER)
        // =========================================================

        _openGenericValueHelp: function (oInputTarget, oConfig) {
            var oView = this.getView();
            this._oCurrentInput = oInputTarget; // Lưu lại ô Input đang bấm
            this._oCurrentVHConfig = oConfig;   // Lưu lại cấu hình 

            // 1. Tạo Model nhỏ để nhét Tiêu đề vào Pop-up
            var oConfigModel = new sap.ui.model.json.JSONModel({
                title: oConfig.title,
                noDataText: oConfig.noDataText
            });
            oView.setModel(oConfigModel, "vhConfig");

            // 2. Load Fragment lên
            if (!this._pGenericVHDialog) {
                this._pGenericVHDialog = sap.ui.core.Fragment.load({
                    id: oView.getId(),
                    name: "com.app.zu26g13.app.view.GenericValueHelp", 
                    controller: this
                }).then(function (oPopover) {
                    oView.addDependent(oPopover);
                    return oPopover;
                });
            }

            this._pGenericVHDialog.then(function(oPopover) {
                // Phải lấy thẻ List bên trong Popover ra để bơm data
                var oList = oView.byId("genericSearchHelpList");
                
                // 3. Xóa data cũ
                oList.unbindAggregation("items");

                // 4. Định nghĩa form giao diện của từng dòng
                var oTemplate = new sap.m.StandardListItem({
                    title: "{" + oConfig.titleField + "}",
                    description: "{" + oConfig.descField + "}",
                    info: oConfig.infoField ? "{" + oConfig.infoField + "}" : ""
                });

                // 5. Bơm đường dẫn OData
                oList.bindAggregation("items", {
                    path: oConfig.entitySet,
                    template: oTemplate
                });

                // 6. MỞ POPOVER NGAY DƯỚI ĐÍT Ô INPUT VỪA BẤM
                oPopover.openBy(oInputTarget);
            });
        },

        // Các hàm gọi _openGenericValueHelp cho Nhân viên và Phòng ban vẫn giữ nguyên!
        onEmpValueHelpRequest: function (oEvent) {
            this._openGenericValueHelp(oEvent.getSource(), {
                type: "EMP",
                title: "Chọn Nhân Viên",
                noDataText: "Không có dữ liệu nhân viên",
                entitySet: "/Employee",
                titleField: "Ename", 
                descField: "Pernr",  
                infoField: "DeptId", 
                searchFields: ["Ename", "Pernr"] 
            });
        },

        onDeptValueHelpRequest: function (oEvent) {
            this._openGenericValueHelp(oEvent.getSource(), {
                type: "DEPT",
                title: "Chọn Phòng Ban",
                noDataText: "Không có dữ liệu phòng ban",
                entitySet: "/Department",
                titleField: "DeptName", 
                descField: "DeptId",    
                searchFields: ["DeptName", "DeptId"]
            });
        },

        // --- CẬP NHẬT 3 HÀM XỬ LÝ LỌC VÀ CHỌN CỦA POPOVER ---

        onGenericValueHelpSearch: function (oEvent) {
            // Với SearchField, biến chữ gõ vào là newValue hoặc query
            var sValue = oEvent.getParameter("newValue") || oEvent.getParameter("query"); 
            var oConfig = this._oCurrentVHConfig;
            var oFilter;

            if (sValue && oConfig.searchFields.length > 0) {
                var aFilters = [];
                oConfig.searchFields.forEach(function(sField) {
                    aFilters.push(new sap.ui.model.Filter(sField, sap.ui.model.FilterOperator.Contains, sValue));
                });
                oFilter = new sap.ui.model.Filter({ filters: aFilters, and: false });
            }

            var oList = this.getView().byId("genericSearchHelpList");
            var oBinding = oList.getBinding("items");
            oBinding.filter(oFilter ? [oFilter] : []);
        },

onGenericValueHelpConfirm: function (oEvent) {
            // Với List (mode=SingleSelectMaster), dùng listItem thay vì selectedItem
            var oSelectedItem = oEvent.getParameter("listItem"); 
            if (oSelectedItem && this._oCurrentInput) {
                var sCode = oSelectedItem.getDescription(); 
                this._oCurrentInput.setValue(sCode);
                if (this.onSearch) {
                    this.onSearch();
                }

                var oPopover = this.getView().byId("genericSearchHelpPopover");
                if (oPopover) {
                    oPopover.close();
                }
            }
        },

        onGenericValueHelpCancel: function () {
            var oPopover = this.getView().byId("genericSearchHelpPopover");
            if (oPopover) {
                oPopover.close();
            }
        },

        // =========================================================
        // CÁC HÀM XỬ LÝ NAVIGATION VÀ FILTER BẢNG DASHBOARD
        // =========================================================

        onGoToDispute: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("dispute");
        },

        onNavToSchedule: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("schedule");
        },

        onFilterStatus: function (oEvent) {
            var sKey = oEvent.getParameter("item").getKey();
            var aFilters = [];

            if (sKey !== "ALL") {
                if (sKey === "ERROR") {
                    var oFilterLate = new Filter("Status", FilterOperator.EQ, "LATE_IN");
                    var oFilterEarly = new Filter("Status", FilterOperator.EQ, "EARLY_OUT");
                    aFilters.push(new Filter({ filters: [oFilterLate, oFilterEarly], and: false }));
                } else {
                    aFilters.push(new Filter("Status", FilterOperator.EQ, sKey));
                }
            }

            var oTable = this.byId("timesheetTable");
            var oBinding = oTable.getBinding("items");
            oBinding.filter(aFilters);
        },

        onSearch: function () {
            var aFilters = [];
            var sEmp = this.byId("fltEmp").getValue();
            // ĐÃ SỬA: Dùng getValue() thay vì getSelectedKey() vì mình đã chuyển sang Input F4
            var sDept = this.byId("fltDept").getValue(); 
            var oDate = this.byId("fltDate").getDateValue();

            if (sEmp) {
                aFilters.push(new Filter("Pernr", FilterOperator.Contains, sEmp));
            }
            if (sDept) {
                aFilters.push(new Filter("DeptId", FilterOperator.EQ, sDept));
            }

            // XỬ LÝ NGÀY THÁNG CHUẨN UTC ĐỂ KHÔNG BỊ LỆCH MÚI GIỜ
            if (oDate) {
                var y = oDate.getFullYear();
                var m = oDate.getMonth();
                var d = oDate.getDate();

                // Tạo Date Object chuẩn UTC (Backend ABAP sẽ nhận đúng ngày, không bị lùi 7 tiếng)
                var dStart = new Date(Date.UTC(y, m, d, 0, 0, 0));
                var dEnd = new Date(Date.UTC(y, m, d, 23, 59, 59));

                aFilters.push(new Filter("WorkDate", FilterOperator.BT, dStart, dEnd));
            }

            var oTable = this.byId("timesheetTable");
            var oBinding = oTable.getBinding("items");

            // Áp dụng bộ lọc vào bảng
            oBinding.filter(aFilters);
        },

        onClear: function () {
            this.byId("fltEmp").setValue("");
            this.byId("fltDept").setValue(""); // Đã sửa setSelectedKey("") thành setValue("")
            this.byId("fltDate").setValue("");
            this.byId("timesheetTable").getBinding("items").filter([]);
        },

        onNavToEmployee: function () {
            // Nhảy sang trang Employees (dựa theo tên route trong manifest)
            this.getOwnerComponent().getRouter().navTo("employeeConfig");
        },

        onNavToMonthlyReport: function () {
            // Nhảy sang trang Báo cáo tháng
            this.getOwnerComponent().getRouter().navTo("monthlyReport");
        },

        // MỚI: Cấu hình các cột để xuất file Excel (Dùng chuỗi String trực tiếp)
        _createColumnConfig: function () {
            return [
                { label: 'Employee ID', property: 'Pernr', type: 'String' },
                { label: 'Department', property: 'DeptId', type: 'String' },
                { label: 'Shift', property: 'ShiftId', type: 'String' },
                { label: 'Work Date', property: 'WorkDate', type: 'Date' },
                { label: 'Check In', property: 'ActIn', type: 'Time' },
                { label: 'Check Out', property: 'ActOut', type: 'Time' },
                { label: 'Standard Hours', property: 'WorkHours', type: 'Number', scale: 2 },
                { label: 'Actual Hours', property: 'TotHours', type: 'Number', scale: 2 },
                { label: 'Overtime Hours', property: 'OtHours', type: 'Number', scale: 2 },
                { label: 'Status', property: 'Status', type: 'String' }
            ];
        },

        // MỚI: Xử lý chức năng xuất Excel
        onExportExcel: function () {
            var oTable = this.byId("timesheetTable");
            var oRowBinding = oTable.getBinding("items");
            var aCols = this._createColumnConfig();

            // 1. Phải khởi tạo Date và cắt ngày tháng năm ra trước
            var oDate = new Date();
            var sDay = String(oDate.getDate()).padStart(2, '0');
            var sMonth = String(oDate.getMonth() + 1).padStart(2, '0');
            var sYear = oDate.getFullYear();

            // Ráp lại thành tên file (VD: DashboardReport_21072026.xlsx)
            var sFileName = "DashboardReport_" + sDay + sMonth + sYear + ".xlsx";

            // 2. Cấu hình xuất Excel
            var oSettings = {
                workbook: {
                    columns: aCols,
                    context: {
                        sheetName: 'Data' // Đặt tên sheet ngắn gọn vào đây
                    }
                },
                dataSource: oRowBinding,
                fileName: sFileName, // Gọi cái biến sFileName vừa tạo ở trên
                worker: false
            };

            // 3. Thực thi tải file
            var oSheet = new Spreadsheet(oSettings);
            oSheet.build().finally(function () {
                oSheet.destroy();
            });
        },
    });
});