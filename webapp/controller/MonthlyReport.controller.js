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
        },

// ==========================================================
        // TÍNH NĂNG SEARCH HELP (DẠNG POPOVER CHO NHÂN VIÊN)
        // ==========================================================

        onEmployeeValueHelpRequest: function (oEvent) {
            var oView = this.getView();
            // Lấy thẻ Input làm "mỏ neo" để lát Popover biết chỗ mà hiển thị dưới chân
            this._oInputEmp = oEvent.getSource(); 

            if (!this._pEmpValueHelpDialog) {
                this._pEmpValueHelpDialog = sap.ui.core.Fragment.load({
                    id: oView.getId(),
                    name: "com.app.zu26g13.app.view.EmployeeValueHelp", 
                    controller: this
                }).then(function (oPopover) {
                    oView.addDependent(oPopover);
                    return oPopover;
                });
            }
            this._pEmpValueHelpDialog.then(function(oPopover) {
                // Clear bộ lọc cũ đi mỗi lần mở lại
                var oList = this.byId("empValueHelpList");
                if (oList) { oList.getBinding("items").filter([]); }
                
                // MA THUẬT: Mở Popover ngay dưới thẻ Input
                oPopover.openBy(this._oInputEmp);
            }.bind(this));
        },

        onEmployeeValueHelpSearch: function (oEvent) {
            // Bắt text tìm kiếm (hỗ trợ cả gõ phím lẫn ấn kính lúp)
            var sValue = oEvent.getParameter("value") || oEvent.getParameter("newValue");
            
            var oFilterName = new sap.ui.model.Filter("Ename", sap.ui.model.FilterOperator.Contains, sValue);
            var oFilterId = new sap.ui.model.Filter("Pernr", sap.ui.model.FilterOperator.Contains, sValue);
            
            var oCombinedFilter = new sap.ui.model.Filter({
                filters: [oFilterName, oFilterId],
                and: false
            });
            
            // Trỏ thẳng vào cái List mới tạo trong XML để lọc
            this.byId("empValueHelpList").getBinding("items").filter([oCombinedFilter]);
        },

        onEmployeeValueHelpConfirm: function (oEvent) {
            // Vì đổi sang dùng thẻ List nên cách lấy dữ liệu là "listItem"
            var oSelectedItem = oEvent.getParameter("listItem"); 
            if (oSelectedItem) {
                var sEmpId = oSelectedItem.getDescription();
                this._oInputEmp.setValue(sEmpId);
                
                if (this.onSearch) {
                    this.onSearch(); 
                }
            }
            
            // Chọn xong tự động đóng
            if (this._pEmpValueHelpDialog) {
                this._pEmpValueHelpDialog.then(function(oPopover) { oPopover.close(); });
            }
        },

        onEmployeeValueHelpCancel: function () {
            // Đóng Popover
            if (this._pEmpValueHelpDialog) {
                this._pEmpValueHelpDialog.then(function(oPopover) { oPopover.close(); });
            }
        }

        
    });
    
});