sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/export/Spreadsheet",
    "sap/ui/core/Fragment",
  ],
  function (Controller, Filter, FilterOperator, Spreadsheet, Fragment) {
    "use strict";

    return Controller.extend("com.app.zu26g13.app.controller.MonthlyReport", {
      onInit: function () {
        // Default to current month upon navigation
        var oRouter = this.getOwnerComponent().getRouter();
        oRouter
          .getRoute("monthlyReport")
          .attachPatternMatched(this._onRouteMatched, this);
      },

      _onRouteMatched: function () {
        var oDatePicker = this.byId("fltMonth");
        // Set current date
        oDatePicker.setDateValue(new Date());
        this.onSearch();
      },

      // Helper to get text from i18n properties
      _getI18nText: function (sKey) {
        return this.getView()
          .getModel("i18n")
          .getResourceBundle()
          .getText(sKey);
      },

      // =========================================================
      // FILTER LOGIC
      // =========================================================

      onSearch: function () {
        var aFilters = [];
        var oDate = this.byId("fltMonth").getDateValue();
        var sEmp = this.byId("fltEmp").getValue();

        aFilters.push(new Filter("EmployeeName", FilterOperator.NE, null));
        aFilters.push(new Filter("EmployeeName", FilterOperator.NE, ""));

        // If user selects a month (e.g., 07/2026)
        if (oDate) {
          var y = oDate.getFullYear();
          var m = oDate.getMonth() + 1;
          var sMonthYear = String(m).padStart(2, "0") + "/" + y;

          // Filter by Month/Year string
          aFilters.push(new Filter("MonthYear", FilterOperator.EQ, sMonthYear));
        }

        if (sEmp) {
          aFilters.push(new Filter("Pernr", FilterOperator.EQ, sEmp));
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

      // =========================================================
      // EXPORT EXCEL LOGIC (ĐÃ CẬP NHẬT CỘT MỚI)
      // =========================================================

      _createColumnConfig: function () {
        return [
          { label: this._getI18nText("colEmpId"), property: "Pernr", type: "String" },
          { label: this._getI18nText("colEmpName"), property: "EmployeeName", type: "String" }, 
          { label: this._getI18nText("colMonthYear"), property: "MonthYear", type: "String" },

          // Ngày Thường
          { label: this._getI18nText("colRegShifts"), property: "RegularShiftCount", type: "Number", scale: 0 },
          { label: this._getI18nText("colRegHours"), property: "RegularPaidHours", type: "Number", scale: 2 },
          { label: this._getI18nText("colRegOtHours"), property: "RegularOtHours", type: "Number", scale: 2 },
          { label: this._getI18nText("colRegRate"), property: "RegularRate", type: "Number", scale: 2 },
          { label: this._getI18nText("colRegOtRate"), property: "RegularOtRate", type: "Number", scale: 2 },

          // Cuối Tuần
          { label: this._getI18nText("colWeShifts"), property: "WeekendShiftCount", type: "Number", scale: 0 },
          { label: this._getI18nText("colWeHours"), property: "WeekendPaidHours", type: "Number", scale: 2 },
          { label: this._getI18nText("colWeOtHours"), property: "WeekendOtHours", type: "Number", scale: 2 },
          { label: this._getI18nText("colWeRate"), property: "WeekendRate", type: "Number", scale: 2 },

          // Lễ
          { label: this._getI18nText("colHolShifts"), property: "HolidayShiftCount", type: "Number", scale: 0 },
          { label: this._getI18nText("colHolHours"), property: "HolidayPaidHours", type: "Number", scale: 2 },
          { label: this._getI18nText("colHolOtHours"), property: "HolidayOtHours", type: "Number", scale: 2 },
          { label: this._getI18nText("colHolRate"), property: "HolidayRate", type: "Number", scale: 2 }
        ];
      },

      onExportExcel: function () {
        var oTable = this.byId("monthlyTable");
        var oRowBinding = oTable.getBinding("items");
        var aCols = this._createColumnConfig();

        // Format date for filename
        var oDate = new Date();
        var sDay = String(oDate.getDate()).padStart(2, "0");
        var sMonth = String(oDate.getMonth() + 1).padStart(2, "0");
        var sYear = oDate.getFullYear();

        // Construct filename (e.g., MonthlyReport_31072026.xlsx)
        var sFileName = "MonthlyReport_" + sDay + sMonth + sYear + ".xlsx";

        // Excel export settings
        var oSettings = {
          workbook: {
            columns: aCols,
            context: {
              sheetName: this._getI18nText("sheetNameData"),
            },
          },
          dataSource: oRowBinding,
          fileName: sFileName,
          worker: false,
        };

        // Trigger download
        var oSheet = new Spreadsheet(oSettings);
        oSheet.build().finally(function () {
          oSheet.destroy();
        });
      },

      // ==========================================================
      // EMPLOYEE VALUE HELP (POPOVER)
      // ==========================================================

      onEmployeeValueHelpRequest: function (oEvent) {
        var oView = this.getView();
        // Get input field as anchor for Popover
        this._oInputEmp = oEvent.getSource();

        if (!this._pEmpValueHelpDialog) {
          this._pEmpValueHelpDialog = Fragment.load({
            id: oView.getId(),
            name: "com.app.zu26g13.app.view.EmployeeValueHelp",
            controller: this,
          }).then(function (oPopover) {
            oView.addDependent(oPopover);
            return oPopover;
          });
        }

        this._pEmpValueHelpDialog.then(
          function (oPopover) {
            // Clear previous filter
            var oList = this.byId("empValueHelpList");
            if (oList) {
              oList.getBinding("items").filter([]);
            }

            // Open Popover below the input field
            oPopover.openBy(this._oInputEmp);
          }.bind(this),
        );
      },

      onEmployeeValueHelpSearch: function (oEvent) {
        // Capture search text
        var sValue =
          oEvent.getParameter("value") || oEvent.getParameter("newValue");

        var oFilterName = new Filter("Ename", FilterOperator.Contains, sValue);
        var oFilterId = new Filter("Pernr", FilterOperator.EQ, sValue);

        var oCombinedFilter = new Filter({
          filters: [oFilterName, oFilterId],
          and: false,
        });

        // Apply filter to List
        this.byId("empValueHelpList")
          .getBinding("items")
          .filter([oCombinedFilter]);
      },

      onEmployeeValueHelpConfirm: function (oEvent) {
        var oSelectedItem = oEvent.getParameter("listItem");
        if (oSelectedItem) {
          var sEmpId = oSelectedItem.getDescription();
          this._oInputEmp.setValue(sEmpId);

          if (this.onSearch) {
            this.onSearch();
          }
        }

        // Auto close on selection
        if (this._pEmpValueHelpDialog) {
          this._pEmpValueHelpDialog.then(function (oPopover) {
            oPopover.close();
          });
        }
      },

      onEmployeeValueHelpCancel: function () {
        if (this._pEmpValueHelpDialog) {
          this._pEmpValueHelpDialog.then(function (oPopover) {
            oPopover.close();
          });
        }
      },
    });
  },
);