sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Controller, Filter, FilterOperator) {
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

        onExportExcel: function () {
            sap.m.MessageToast.show("Sếp có thể gắn thư viện Spreadsheet vào đây giống hệt trang Dashboard để xuất Excel!");
        }
    });
});