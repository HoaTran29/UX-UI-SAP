sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/export/Spreadsheet"
], function (Controller, Filter, FilterOperator, Spreadsheet) {
    "use strict";

    return Controller.extend("com.app.zu26g13.app.controller.MonthlyReport", {

        onInit: function () {
            // Mặc định load tháng hiện tại khi vừa vào trang
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("monthlyReport").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function () {
            var oDatePicker = this.byId("fltMonth");
            // Set tháng hiện tại
            oDatePicker.setDateValue(new Date());
            this.onSearch();
        },

        onSearch: function () {
            var aFilters = [];
            var oDate = this.byId("fltMonth").getDateValue();
            var sEmp = this.byId("fltEmp").getValue();

            // Nếu người dùng chọn tháng (Ví dụ: Tháng 07/2026)
            if (oDate) {
                var y = oDate.getFullYear();
                var m = oDate.getMonth() + 1; // getMonth() trả về 0-11
                var sMonthYear = String(m).padStart(2, '0') + "/" + y; // Tạo chuỗi "07/2026"

                // Lọc theo chuỗi Tháng/Năm
                aFilters.push(new Filter("MonthYear", FilterOperator.EQ, sMonthYear));
            }

            if (sEmp) {
                aFilters.push(new Filter("Pernr", FilterOperator.Contains, sEmp));
            }

            var oTable = this.byId("monthlyTable");
            oTable.getBinding("items").filter(aFilters);
        },

        onClear: function () {
            this.byId("fltMonth").setDateValue(new Date());
            this.byId("fltEmp").setValue("");
            this.onSearch();
        },

        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("dashboard");
        },
        // --- BẮT ĐẦU CODE XUẤT EXCEL (Chuẩn form Dashboard) ---

        // Cấu hình các cột để xuất file Excel 
        _createColumnConfig: function () {
            return [
                { label: 'Emp. ID', property: 'Pernr', type: 'String' },
                { label: 'Employee Name', property: 'Ename', type: 'String' }, // Bỏ dòng này nếu backend ko có cột Tên
                { label: 'Month/Year', property: 'MonthYear', type: 'String' },
                { label: 'Total Standard Hours', property: 'TotalStdHours', type: 'Number', scale: 2 },
                { label: 'Total Actual Hours', property: 'TotalActHours', type: 'Number', scale: 2 },
                { label: 'Total OT Hours', property: 'TotalOtHours', type: 'Number', scale: 2 }
            ];
        },

        // Xử lý chức năng xuất Excel
        onExportExcel: function () {
            // LƯU Ý: Sửa chữ "monthlyTable" thành đúng ID thẻ <Table> trong file XML của sếp nha
            var oTable = this.byId("monthlyTable");
            var oRowBinding = oTable.getBinding("items");
            var aCols = this._createColumnConfig();

            // 1. Phải khởi tạo Date và cắt ngày tháng năm ra trước
            var oDate = new Date();
            var sDay = String(oDate.getDate()).padStart(2, '0');
            var sMonth = String(oDate.getMonth() + 1).padStart(2, '0');
            var sYear = oDate.getFullYear();

            // Ráp lại thành tên file (VD: MonthlyReport_31072026.xlsx)
            var sFileName = "MonthlyReport_" + sDay + sMonth + sYear + ".xlsx";

            // 2. Cấu hình xuất Excel
            var oSettings = {
                workbook: {
                    columns: aCols,
                    context: {
                        sheetName: 'Data' // Đặt tên sheet ngắn gọn
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
        }

        // --- KẾT THÚC CODE XUẤT EXCEL ---
    });
    
});