sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/export/Spreadsheet" // CHỈ CẦN KHAI BÁO THÊM ĐÚNG 1 DÒNG NÀY (Bỏ exportLibrary đi)
], function (Controller, JSONModel, Filter, FilterOperator, Spreadsheet) {
    "use strict";

    return Controller.extend("com.app.zu26g13.app.controller.Dashboard", {
        onInit: function () {
            var oKpiModel = new JSONModel({
                totalEmp: 0,
                totalOT: 0,
                pendingDisputes: 0
            });
            this.getView().setModel(oKpiModel, "kpi");

            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("dashboard").attachPatternMatched(this._loadRealKpiData, this);
        },

        _loadRealKpiData: function () {
            var oModel = this.getOwnerComponent().getModel();
            var oKpiModel = this.getView().getModel("kpi");
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
        },

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
            var sDept = this.byId("fltDept").getSelectedKey();
            var oDate = this.byId("fltDate").getDateValue();

            if (sEmp) {
                aFilters.push(new sap.ui.model.Filter("Pernr", sap.ui.model.FilterOperator.Contains, sEmp));
            }
            if (sDept) {
                aFilters.push(new sap.ui.model.Filter("DeptId", sap.ui.model.FilterOperator.EQ, sDept));
            }

            // XỬ LÝ NGÀY THÁNG CHUẨN UTC ĐỂ KHÔNG BỊ LỆCH MÚI GIỜ
            if (oDate) {
                var y = oDate.getFullYear();
                var m = oDate.getMonth();
                var d = oDate.getDate();

                // Tạo Date Object chuẩn UTC (Backend ABAP sẽ nhận đúng ngày, không bị lùi 7 tiếng)
                var dStart = new Date(Date.UTC(y, m, d, 0, 0, 0));
                var dEnd = new Date(Date.UTC(y, m, d, 23, 59, 59));

                aFilters.push(new sap.ui.model.Filter("WorkDate", sap.ui.model.FilterOperator.BT, dStart, dEnd));
            }

            var oTable = this.byId("timesheetTable");
            var oBinding = oTable.getBinding("items");

            // Áp dụng bộ lọc vào bảng
            oBinding.filter(aFilters);
        },

        onClear: function () {
            this.byId("fltEmp").setValue("");
            this.byId("fltDept").setSelectedKey("");
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
                { label: 'Mã Nhân Viên', property: 'Pernr', type: 'String' },
                { label: 'Phòng ban', property: 'DeptId', type: 'String' },
                { label: 'Ca làm việc', property: 'ShiftId', type: 'String' },
                { label: 'Ngày làm việc', property: 'WorkDate', type: 'Date' },
                { label: 'Giờ In', property: 'ActIn', type: 'Time' },
                { label: 'Giờ Out', property: 'ActOut', type: 'Time' },
                { label: 'Giờ tiêu chuẩn', property: 'WorkHours', type: 'Number', scale: 2 },
                { label: 'Giờ thực tế', property: 'TotHours', type: 'Number', scale: 2 },
                { label: 'Giờ OT', property: 'OtHours', type: 'Number', scale: 2 },
                { label: 'Trạng thái', property: 'Status', type: 'String' }
            ];
        },

        // MỚI: Xử lý chức năng xuất Excel
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
                        sheetName: 'Data' // <--- Đặt tên sheet ngắn gọn vào đây
                    }
                },
                dataSource: oRowBinding,
                fileName: sFileName, // <--- Gọi cái biến sFileName vừa tạo ở trên
                worker: false
            };

            // 3. Thực thi tải file
            var oSheet = new Spreadsheet(oSettings);
            oSheet.build().finally(function () {
                oSheet.destroy();
            });
        },
        // --- HÀM FORMATTER DỊCH MÃ PHÒNG BAN SANG TÊN ---
        formatDeptName: function (sDeptCode) {
            if (!sDeptCode) {
                return "";
            }
            switch (sDeptCode) {
                case "IT_01": 
                    return "Công nghệ thông tin";
                case "HR_02": 
                    return "Nhân sự";
                case "SALES_03": 
                    return "Kinh doanh";
                default: 
                    return sDeptCode; 
            }
        }
    });
});