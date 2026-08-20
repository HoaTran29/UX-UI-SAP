sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/export/Spreadsheet",
    "sap/ui/core/Fragment"
], function (Controller, Filter, FilterOperator, Spreadsheet, Fragment) {
    "use strict";

    return Controller.extend("com.app.zu26g13.app.controller.MonthlyReport", {
        onInit: function () {
            this.getOwnerComponent().getRouter().getRoute("monthlyReport").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function () {
            // tự động điền tháng hiện tại và search khi vừa vào trang
            this.byId("fltMonth").setDateValue(new Date());
            this.onSearch();
        },

        _getI18nText: function (sKey) {
            return this.getView().getModel("i18n").getResourceBundle().getText(sKey);
        },

        // =========================================================
        // tìm kiếm & lọc
        // =========================================================
        onSearch: function () {
            var aFilters = [];
            var oDate = this.byId("fltMonth").getDateValue();
            var sEmp = this.byId("fltEmp").getValue();

            // luôn loại bỏ những dòng không có tên nhân viên
            aFilters.push(new Filter("EmployeeName", FilterOperator.NE, null));
            aFilters.push(new Filter("EmployeeName", FilterOperator.NE, ""));

            if (oDate) {
                var sMonthYear = String(oDate.getMonth() + 1).padStart(2, "0") + "/" + oDate.getFullYear();
                aFilters.push(new Filter("MonthYear", FilterOperator.EQ, sMonthYear));
            }

            if (sEmp) aFilters.push(new Filter("Pernr", FilterOperator.EQ, sEmp));

            this.byId("monthlyTable").getBinding("items").filter(aFilters);
        },

        onClear: function () {
            this.byId("fltMonth").setDateValue(new Date());
            this.byId("fltEmp").setValue("");
            this.onSearch();
        },

        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("dashboard");
        },

        // =========================================================
        // xuất excel
        // =========================================================
        _createColumnConfig: function () {
            return [
                { label: this._getI18nText("colEmpId"), property: "Pernr", type: "String" },
                { label: this._getI18nText("colEmployee"), property: "EmployeeName", type: "String" }, 
                { label: this._getI18nText("colMonthYear"), property: "MonthYear", type: "String" },
                { label: this._getI18nText("colRegShifts"), property: "RegularShiftCount", type: "Number", scale: 0 },
                { label: this._getI18nText("colRegHours"), property: "RegularPaidHours", type: "Number", scale: 2 },
                { label: this._getI18nText("colRegOtHours"), property: "RegularOtHours", type: "Number", scale: 2 },
                { label: this._getI18nText("colRegRate"), property: "RegularRate", type: "Number", scale: 2 },
                { label: this._getI18nText("colRegOtRate"), property: "RegularOtRate", type: "Number", scale: 2 },
                { label: this._getI18nText("colWeShifts"), property: "WeekendShiftCount", type: "Number", scale: 0 },
                { label: this._getI18nText("colWeHours"), property: "WeekendPaidHours", type: "Number", scale: 2 },
                { label: this._getI18nText("colWeOtHours"), property: "WeekendOtHours", type: "Number", scale: 2 },
                { label: this._getI18nText("colWeRate"), property: "WeekendRate", type: "Number", scale: 2 },
                { label: this._getI18nText("colHolShifts"), property: "HolidayShiftCount", type: "Number", scale: 0 },
                { label: this._getI18nText("colHolHours"), property: "HolidayPaidHours", type: "Number", scale: 2 },
                { label: this._getI18nText("colHolOtHours"), property: "HolidayOtHours", type: "Number", scale: 2 },
                { label: this._getI18nText("colHolRate"), property: "HolidayRate", type: "Number", scale: 2 }
            ];
        },

        onExportExcel: function () {
            var oRowBinding = this.byId("monthlyTable").getBinding("items");
            var oDate = new Date();
            var sFileName = "MonthlyReport_" + String(oDate.getDate()).padStart(2, "0") + String(oDate.getMonth() + 1).padStart(2, "0") + oDate.getFullYear() + ".xlsx";

            var oSheet = new Spreadsheet({
                workbook: { columns: this._createColumnConfig(), context: { sheetName: "Data" } },
                dataSource: oRowBinding,
                fileName: sFileName,
                worker: false
            });

            oSheet.build().finally(function () { oSheet.destroy(); });
        },

        // ==========================================================
        // popup chọn nhân viên (value help)
        // ==========================================================
        onEmployeeValueHelpRequest: function (oEvent) {
            var oView = this.getView();
            this._oInputEmp = oEvent.getSource();

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
                var oList = this.byId("empValueHelpList");
                if (oList) oList.getBinding("items").filter([]);
                oPopover.openBy(this._oInputEmp);
            }.bind(this));
        },

        onEmployeeValueHelpSearch: function (oEvent) {
            var sValue = oEvent.getParameter("value") || oEvent.getParameter("newValue");
            var oFilterName = new Filter("Ename", FilterOperator.Contains, sValue);
            var oFilterId = new Filter("Pernr", FilterOperator.EQ, sValue);
            this.byId("empValueHelpList").getBinding("items").filter([new Filter({ filters: [oFilterName, oFilterId], and: false })]);
        },

        onEmployeeValueHelpConfirm: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("listItem");
            if (oSelectedItem) {
                this._oInputEmp.setValue(oSelectedItem.getDescription());
                if (this.onSearch) this.onSearch();
            }
            if (this._pEmpValueHelpDialog) this._pEmpValueHelpDialog.then(function (oPopover) { oPopover.close(); });
        },

        onEmployeeValueHelpCancel: function () {
            if (this._pEmpValueHelpDialog) this._pEmpValueHelpDialog.then(function (oPopover) { oPopover.close(); });
        }
    });
});