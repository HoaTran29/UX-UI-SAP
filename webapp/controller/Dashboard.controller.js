sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/export/Spreadsheet",
    "sap/ui/core/Fragment",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Controller, JSONModel, Filter, FilterOperator, Spreadsheet, Fragment) {
    "use strict";

    return Controller.extend("com.app.zu26g13.app.controller.Dashboard", {
        onInit: function () {
            // Init KPI model
            var oKpiModel = new JSONModel({
                totalEmp: 0,
                totalOT: 0,
                pendingDisputes: 0
            });
            this.getView().setModel(oKpiModel, "kpi");

            // Init Department lookup model
            var oDeptLookupModel = new JSONModel({});
            this.getView().setModel(oDeptLookupModel, "deptLookup");

            // Attach routing events
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("dashboard").attachPatternMatched(this._loadRealKpiData, this);
            oRouter.getRoute("dashboard").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function () {
            // Trigger default search when navigating to the view
            if (this.onSearch) {
                this.onSearch();
            }
        },

        // Helper to get text from i18n properties
        _getI18nText: function (sKey) {
            return this.getView().getModel("i18n").getResourceBundle().getText(sKey);
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

            // Fetch Total Employees
            oModel.read("/Employee", {
                success: function (oData) {
                    oKpiModel.setProperty("/totalEmp", oData.results.length);
                }
            });

            // Fetch Pending Disputes
            oModel.read("/Dispute", {
                filters: [new Filter("Status", FilterOperator.EQ, "PENDING")],
                success: function (oData) {
                    oKpiModel.setProperty("/pendingDisputes", oData.results.length);
                }
            });

            // Fetch Total OT for Current Month
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

            // Fetch Department Lookup Data
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
        // EMPLOYEE VALUE HELP (POPOVER)
        // =========================================================
        onEmpValueHelpRequest: function (oEvent) {
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
                // Remove filter if search input is empty
                oListBinding.filter([]);
            } else {
                // Apply combined filter for search value
                var oFilterName = new Filter("Ename", FilterOperator.Contains, sValue);
                var oFilterId = new Filter("Pernr", FilterOperator.EQ, sValue);
                var oCombinedFilter = new Filter({ filters: [oFilterName, oFilterId], and: false });

                oListBinding.filter([oCombinedFilter]);
            }
        },

        onEmployeeValueHelpConfirm: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("listItem");
            if (oSelectedItem && this._oInputEmp) {
                this._oInputEmp.setValue(oSelectedItem.getDescription());
                if (this.onSearch) { this.onSearch(); }
                this._pEmpValueHelpDialog.then(function (oPopover) { oPopover.close(); });
            }
        },

        onEmployeeValueHelpCancel: function () {
            if (this._pEmpValueHelpDialog) {
                this._pEmpValueHelpDialog.then(function (oPopover) { oPopover.close(); });
            }
        },

        // =========================================================
        // DEPARTMENT VALUE HELP (POPOVER)
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
                // Remove filter to show full list
                oListBinding.filter([]);
            } else {
                // Apply search filter on Name and ID
                var oFilterName = new Filter("DeptName", FilterOperator.Contains, sValue);
                var oFilterId = new Filter("DeptId", FilterOperator.Contains, sValue);
                var oCombinedFilter = new Filter({ filters: [oFilterName, oFilterId], and: false });

                oListBinding.filter([oCombinedFilter]);
            }
        },

        onDeptValueHelpConfirm: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("listItem");
            if (oSelectedItem && this._oInputDept) {
                this._oInputDept.setValue(oSelectedItem.getDescription());
                if (this.onSearch) { this.onSearch(); }
                this._pDeptValueHelpDialog.then(function (oPopover) { oPopover.close(); });
            }
        },

        onDeptValueHelpCancel: function () {
            if (this._pDeptValueHelpDialog) {
                this._pDeptValueHelpDialog.then(function (oPopover) { oPopover.close(); });
            }
        },

        // =========================================================
        // NAVIGATION & FILTERING LOGIC
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

            if (sEmp) {
                aFilters.push(new Filter("Pernr", FilterOperator.EQ, sEmp));
            }
            if (sDept) {
                aFilters.push(new Filter("DeptId", FilterOperator.EQ, sDept));
            }

            // Convert date to UTC to avoid timezone issues
            if (oDate) {
                var y = oDate.getFullYear();
                var m = oDate.getMonth();
                var d = oDate.getDate();

                var dStart = new Date(Date.UTC(y, m, d, 0, 0, 0));
                var dEnd = new Date(Date.UTC(y, m, d, 23, 59, 59));

                aFilters.push(new Filter("WorkDate", FilterOperator.BT, dStart, dEnd));
            }

            // Apply filters to table
            this.byId("timesheetTable").getBinding("items").filter(aFilters);
        },

        onClear: function () {
            this.byId("fltEmp").setValue("");
            this.byId("fltDept").setValue("");
            this.byId("fltDate").setDateValue(null);
            this.byId("timesheetTable").getBinding("items").filter([]);
        },

        // =========================================================
        // EXPORT TO EXCEL
        // =========================================================

        _createColumnConfig: function () {
            return [
                { label: this._getI18nText("colEmpId"), property: 'Pernr', type: 'String' },
                { label: this._getI18nText("colDept"), property: 'DeptId', type: 'String' },
                { label: this._getI18nText("colShift"), property: 'ShiftId', type: 'String' },
                { label: this._getI18nText("colDate"), property: 'WorkDate', type: 'Date' },
                { label: this._getI18nText("colTimeIn"), property: 'ActIn', type: 'Time' },
                { label: this._getI18nText("colTimeOut"), property: 'ActOut', type: 'Time' },
                { label: this._getI18nText("colStdHours"), property: 'WorkHours', type: 'Number', scale: 2 },
                { label: this._getI18nText("colActHours"), property: 'TotHours', type: 'Number', scale: 2 },
                { label: this._getI18nText("colOtHours"), property: 'OtHours', type: 'Number', scale: 2 },
                { label: this._getI18nText("colStatus"), property: 'Status', type: 'String' }
            ];
        },

        onExportExcel: function () {
            var oTable = this.byId("timesheetTable");
            var oRowBinding = oTable.getBinding("items");
            var aCols = this._createColumnConfig();

            // Format date for filename
            var oDate = new Date();
            var sDay = String(oDate.getDate()).padStart(2, '0');
            var sMonth = String(oDate.getMonth() + 1).padStart(2, '0');
            var sYear = oDate.getFullYear();
            var sFileName = "DashboardReport_" + sDay + sMonth + sYear + ".xlsx";

            // Excel export settings
            var oSettings = {
                workbook: {
                    columns: aCols,
                    context: {
                        sheetName: 'Data'
                    }
                },
                dataSource: oRowBinding,
                fileName: sFileName,
                worker: false
            };

            // Trigger download
            var oSheet = new Spreadsheet(oSettings);
            oSheet.build().finally(function () {
                oSheet.destroy();
            });
        },

        // =========================================================
        // FORMATTERS
        // =========================================================
        formatTimeDisplay: function (oTime, sWorkDate, sStatus) {
            if (sWorkDate === 'ABSENT' || sWorkDate === 'LEAVE' || sWorkDate === 'COMPLETED' || sWorkDate === 'CHECK_IN') {
                sStatus = sWorkDate;
            }

            if (sStatus === "ABSENT" || sStatus === "LEAVE") {
                return "N/A";
            }

           if (sStatus === "CHECK_IN" && oTime && (oTime.ms === 0 || oTime === "PT00H00M00S")) {
                return "N/A";
            }

            if (!oTime) {
                return "";
            }

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