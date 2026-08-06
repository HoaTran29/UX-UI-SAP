sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/thirdparty/jquery"
], function (Controller, MessageBox, Fragment, JSONModel, Filter, FilterOperator, jQuery) {
    "use strict";

    return Controller.extend("com.app.zu26g13.app.controller.Schedule", {

        onInit: function () {
            var oODataModel = this.getOwnerComponent().getModel();

            if (oODataModel && oODataModel.setUseBatch) {
                oODataModel.setUseBatch(false);
            }

            this._sEmployeeValueHelpMode = "dialog";
            this._sDepartmentValueHelpMode = "dialog";

            this._initModels();
            this._attachAutoReloadHandlers();

            this.getView().attachEventOnce("modelContextChange", function () {
                this._reloadAllScheduleData();
            }, this);
        },

        onAfterRendering: function () {
            this._installHideMonthsOption();
        },

        onExit: function () {
            jQuery(document).off(".hidePlanningCalendarMonths");

            if (this._bEventBusAttached) {
                sap.ui.getCore().getEventBus().unsubscribe(
                    "codesap",
                    "DataChanged",
                    this._onExternalDataChanged,
                    this
                );
                this._bEventBusAttached = false;
            }

            if (this._iAutoReloadTimer) {
                clearTimeout(this._iAutoReloadTimer);
            }
        },

        _initModels: function () {
            this.getView().setModel(new JSONModel({
                employees: []
            }), "calendarModel");

            this.getView().setModel(new JSONModel({
                shifts: []
            }), "shiftLookupModel");

            this.getView().setModel(new JSONModel({
                employees: [],
                allEmployees: []
            }), "employeeLookupModel");

            this.getView().setModel(new JSONModel({
                departments: [],
                allDepartments: []
            }), "departmentLookupModel");

            this.getView().setModel(new JSONModel({
                employeeQuery: "",
                employeeFilter: "",
                deptQuery: "",
                deptFilter: ""
            }), "headerSearchModel");

            this.getView().setModel(
                new JSONModel(this._getDefaultDialogData()),
                "dialogModel"
            );
        },

        _getDefaultDialogData: function () {
            return {
                AssignMode: "EMP",
                Pernr: "",
                EmployeeName: "",
                DeptId: "",
                DeptName: "",
                StartDate: new Date(),
                EndDate: new Date(),
                PlanDate: new Date(),
                ShiftId: "",
                OldShiftId: "",
                OtHours: "0.00",
                IsOt: false,
                isEdit: false,
                sEmpShiftPath: "",
                sOtPath: ""
            };
        },


        _attachAutoReloadHandlers: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            var oRoute = oRouter && oRouter.getRoute("schedule");

            if (oRoute && !this._bRouteAttached) {
                oRoute.attachPatternMatched(this._onScheduleRouteMatched, this);
                this._bRouteAttached = true;
            }

            if (!this._bEventBusAttached) {
                sap.ui.getCore().getEventBus().subscribe(
                    "codesap",
                    "DataChanged",
                    this._onExternalDataChanged,
                    this
                );
                this._bEventBusAttached = true;
            }
        },

        _onScheduleRouteMatched: function () {
            this._reloadAllScheduleData();
        },

        _onExternalDataChanged: function (sChannel, sEvent, oData) {
            var sSource = oData && oData.source;

            if (["Employee", "Holiday", "Shift", "Schedule"].indexOf(sSource) !== -1) {
                this._reloadAllScheduleData();
            }
        },

        _reloadAllScheduleData: function () {
            if (this._iAutoReloadTimer) {
                clearTimeout(this._iAutoReloadTimer);
            }

            this._iAutoReloadTimer = setTimeout(function () {
                this._loadShiftLookup();
                this._loadCalendarData();
            }.bind(this), 120);
        },

        _publishDataChanged: function (sSource, sAction) {
            sap.ui.getCore().getEventBus().publish("codesap", "DataChanged", {
                source: sSource,
                action: sAction || "refresh",
                timestamp: Date.now()
            });
        },

        _installHideMonthsOption: function () {
            if (this._bHideMonthsOptionInstalled) {
                return;
            }

            this._bHideMonthsOptionInstalled = true;

            var fnHideMonths = function () {
                this._hideMonthsOption();
            }.bind(this);

            jQuery(document).on("click.hidePlanningCalendarMonths", function () {
                setTimeout(fnHideMonths, 50);
                setTimeout(fnHideMonths, 150);
                setTimeout(fnHideMonths, 300);
            });

            jQuery(document).on("keydown.hidePlanningCalendarMonths", function () {
                setTimeout(fnHideMonths, 50);
                setTimeout(fnHideMonths, 150);
                setTimeout(fnHideMonths, 300);
            });

            fnHideMonths();
        },

        _hideMonthsOption: function () {
            jQuery(".sapMSelectListItemBase, .sapMSelectListItem").each(function () {
                var oItem = jQuery(this);
                var sText = oItem.text().trim();

                if (sText === "Months") {
                    oItem.hide();
                    oItem.attr("aria-hidden", "true");
                }
            });
        },

        _loadCalendarData: function () {
            var oCalendarModel = this.getView().getModel("calendarModel");
            var oODataModel = this.getView().getModel();

            sap.ui.core.BusyIndicator.show(0);

            Promise.all([
                this._readSet("/EmpShift"),
                this._readSet("/OtPlan").catch(function () {
                    return [];
                }),
                this._loadEmployeeLookup().catch(function () {
                    return null;
                })
            ]).then(function (aResult) {
                var aEmpShift = aResult[0] || [];
                var aOtPlan = aResult[1] || [];
                var aEmployees = aResult[2];
                var mEmployeeByPernr = aEmployees ? this._buildEmployeeMap(aEmployees) : null;

                var aCalendarEmployees = this._buildCalendarEmployees(
                    aEmpShift,
                    aOtPlan,
                    oODataModel,
                    mEmployeeByPernr
                );

                oCalendarModel.setProperty("/employees", aCalendarEmployees);

                sap.ui.core.BusyIndicator.hide();

                setTimeout(function () {
                    this._hideMonthsOption();
                    this._applyHeaderFilters();
                }.bind(this), 100);
            }.bind(this)).catch(function (oError) {
                sap.ui.core.BusyIndicator.hide();
                console.error("Error while loading schedule data:", oError);

                MessageBox.error(this._getODataErrorMessage(
                    oError,
                    "Unable to load work schedule data from SAP backend."
                ), {
                    title: "Unable to Load Schedule"
                });
            }.bind(this));
        },

        _buildEmployeeMap: function (aEmployees) {
            var mEmployeeByPernr = {};

            (aEmployees || []).forEach(function (oEmployee) {
                var sKey = this._normalizePernrForCompare(oEmployee.Pernr);

                if (sKey) {
                    mEmployeeByPernr[sKey] = oEmployee;
                }
            }.bind(this));

            return mEmployeeByPernr;
        },

        _buildCalendarEmployees: function (aEmpShift, aOtPlan, oODataModel, mEmployeeByPernr) {
            var mOtByKey = {};
            var oGrouped = {};

            aOtPlan.forEach(function (ot) {
                var sPernrKey = this._normalizePernrForCompare(ot.Pernr);
                var sDateKey = this._dateKey(this._toDate(ot.PlanDate));

                if (sPernrKey) {
                    mOtByKey[sPernrKey + "|" + sDateKey] = ot;
                }
            }.bind(this));

            aEmpShift.forEach(function (item) {
                var sPernrKey = this._normalizePernrForCompare(item.Pernr);

                if (mEmployeeByPernr && !mEmployeeByPernr[sPernrKey]) {
                    return;
                }

                var oEmployeeMaster = mEmployeeByPernr ? mEmployeeByPernr[sPernrKey] : null;

                var sDisplayPernr = oEmployeeMaster && oEmployeeMaster.Pernr
                    ? oEmployeeMaster.Pernr
                    : item.Pernr;

                var sEmployeeName = oEmployeeMaster && oEmployeeMaster.EmployeeName
                    ? oEmployeeMaster.EmployeeName
                    : item.EmployeeName || "Unknown Employee";

                var sDeptId = oEmployeeMaster && oEmployeeMaster.DeptId
                    ? oEmployeeMaster.DeptId
                    : item.DeptId || "";

                var sDeptName = oEmployeeMaster && oEmployeeMaster.DeptName
                    ? oEmployeeMaster.DeptName
                    : item.DeptName || "";

                var dWorkDate = this._toDate(item.WorkDate);
                var sDateKey = this._dateKey(dWorkDate);
                var sOtKey = sPernrKey + "|" + sDateKey;
                var oOt = mOtByKey[sOtKey];

                var dStartDate = new Date(dWorkDate);
                dStartDate.setHours(0, 30, 0, 0);

                var dEndDate = new Date(dWorkDate);
                dEndDate.setHours(22, 30, 0, 0);

                var sShiftTimeIn = this._formatTime(item.ShiftTimeIn);
                var sShiftTimeOut = this._formatTime(item.ShiftTimeOut);
                var sShiftTimeText = sShiftTimeIn + " - " + sShiftTimeOut;
                var sOtHours = oOt ? String(oOt.OtHours || "0.00") : "0.00";

                if (!oGrouped[sPernrKey]) {
                    oGrouped[sPernrKey] = {
                        Pernr: sDisplayPernr,
                        RealPernr: item.Pernr,
                        EmployeeName: sEmployeeName,
                        DeptId: sDeptId,
                        DeptName: sDeptName,
                        appointments: []
                    };
                }

                oGrouped[sPernrKey].appointments.push({
                    Pernr: item.Pernr,
                    DisplayPernr: sDisplayPernr,
                    EmployeeName: sEmployeeName,
                    DeptId: sDeptId,
                    DeptName: sDeptName,

                    PlanDate: dWorkDate,
                    WorkDate: dWorkDate,
                    StartDate: dStartDate,
                    EndDate: dEndDate,

                    ShiftId: item.ShiftId,
                    OldShiftId: item.ShiftId,
                    ShiftTimeIn: sShiftTimeIn,
                    ShiftTimeOut: sShiftTimeOut,
                    ShiftTimeText: sShiftTimeText,
                    OtHours: sOtHours,
                    IsOt: oOt ? oOt.IsOt : false,

                    AppointmentTitle: "Shift: " + item.ShiftId,
                    AppointmentText: sShiftTimeText + " | OT: " + sOtHours + "h",
                    AppointmentTooltip:
                        "Employee: " + sEmployeeName +
                        " | Employee ID: " + sDisplayPernr +
                        " | Department: " + (sDeptName || sDeptId || "N/A") +
                        " | Shift: " + item.ShiftId +
                        " | Time: " + sShiftTimeText +
                        " | OT: " + sOtHours + "h",

                    sEmpShiftPath: this._buildEmpShiftPath(
                        oODataModel,
                        item.Pernr,
                        dWorkDate,
                        item.ShiftId
                    ),

                    sOtPath: oOt ? oODataModel.createKey("/OtPlan", {
                        Pernr: oOt.Pernr,
                        PlanDate: this._toODataDate(this._toDate(oOt.PlanDate))
                    }) : ""
                });
            }.bind(this));

            return Object.values(oGrouped);
        },

        _loadShiftLookup: function () {
            var oODataModel = this.getView().getModel();
            var oShiftLookupModel = this.getView().getModel("shiftLookupModel");
            var oDialogModel = this.getView().getModel("dialogModel");

            if (!oODataModel) {
                return;
            }

            oODataModel.read("/ShiftLookup", {
                success: function (oData) {
                    var aShifts = (oData.results || []).map(function (item) {
                        return {
                            ShiftId: item.ShiftId,
                            TimeIn: item.TimeIn,
                            TimeOut: item.TimeOut,
                            ShiftText: item.ShiftId + " - " +
                                this._formatTime(item.TimeIn) + " to " +
                                this._formatTime(item.TimeOut)
                        };
                    }.bind(this));

                    oShiftLookupModel.setProperty("/shifts", aShifts);

                    if (!oDialogModel.getProperty("/ShiftId") && aShifts.length > 0) {
                        oDialogModel.setProperty("/ShiftId", aShifts[0].ShiftId);
                    }
                }.bind(this),
                error: function (oError) {
                    console.error("Error while reading /ShiftLookup:", oError);

                    MessageBox.error(this._getODataErrorMessage(
                        oError,
                        "Unable to load shift list from ZTA_SCHEDULE."
                    ), {
                        title: "Unable to Load Shifts"
                    });
                }.bind(this)
            });
        },

        _loadEmployeeLookup: function () {
            var oEmployeeModel = this.getView().getModel("employeeLookupModel");

            return this._readSet("/Employee").then(function (aData) {
                var aEmployees = aData.map(function (item) {
                    return {
                        Pernr: item.Pernr || item.pernr || "",
                        EmployeeName: item.EmployeeName ||
                            item.Ename ||
                            item.ename ||
                            item.Name ||
                            item.name ||
                            "Unknown Employee",
                        DeptId: item.DeptId ||
                            item.dept_id ||
                            item.Department ||
                            item.department ||
                            "",
                        DeptName: item.DeptName ||
                            item.dept_name ||
                            ""
                    };
                });
            }
            this._pEmpValueHelpDialog.then(function (oPopover) {
                var oList = this.byId("empValueHelpList");
                if (oList) {
                    oList.getBinding("items").filter([]);
                    oList.removeSelections(true);
                }
                oPopover.openBy(this._oCurrentInput);
            }.bind(this));
        },

        onEmployeeValueHelpSearch: function (oEvent) {
            var sValue = oEvent.getParameter("value") || oEvent.getParameter("newValue");
            var oFilterName = new Filter("Ename", FilterOperator.Contains, sValue);
            var oFilterId = new Filter("Pernr", FilterOperator.EQ, sValue);
            this.byId("empValueHelpList").getBinding("items").filter([
                new Filter({ filters: [oFilterName, oFilterId], and: false })
            ]);
        },

                aEmployees.sort(function (a, b) {
                    return String(a.EmployeeName || "").localeCompare(
                        String(b.EmployeeName || ""),
                        "vi"
                    );
                });

                oEmployeeModel.setProperty("/employees", aEmployees);
                oEmployeeModel.setProperty("/allEmployees", aEmployees);

                return aEmployees;
            }).catch(function (oError) {
                console.error("Error while reading /Employee:", oError);
                throw oError;
            });
        },

        _loadDepartmentLookup: function () {
            var oDepartmentModel = this.getView().getModel("departmentLookupModel");

            return this._readSet("/Department").then(function (aData) {
                var aDepartments = aData.map(function (item) {
                    return {
                        DeptId: item.DeptId || item.dept_id || "",
                        DeptName: item.DeptName || item.dept_name || ""
                    };
                });

                aDepartments.sort(function (a, b) {
                    return String(a.DeptName || "").localeCompare(
                        String(b.DeptName || ""),
                        "vi"
                    );
                });

                oDepartmentModel.setProperty("/departments", aDepartments);
                oDepartmentModel.setProperty("/allDepartments", aDepartments);

                return aDepartments;
            }).catch(function (oError) {
                console.error("Error while reading /Department:", oError);
                throw oError;
            });
        },

        onHeaderEmployeeValueHelpRequest: function () {
            this._openEmployeeValueHelp("headerEmployee");
        },

        onHeaderEmployeeLiveChange: function (oEvent) {
            this._setHeaderFilter("employee", oEvent.getParameter("value") || oEvent.getParameter("newValue") || "");
        },

        onHeaderEmployeeSubmit: function (oEvent) {
            this._setHeaderFilter("employee", oEvent.getParameter("value") || "");
        },

        onHeaderDepartmentValueHelpRequest: function () {
            this._openDepartmentValueHelp("headerDepartment");
        },

        onHeaderDepartmentLiveChange: function (oEvent) {
            this._setHeaderFilter("department", oEvent.getParameter("value") || oEvent.getParameter("newValue") || "");
        },

        onHeaderDepartmentSubmit: function (oEvent) {
            this._setHeaderFilter("department", oEvent.getParameter("value") || "");
        },

        onClearHeaderFilters: function () {
            this.getView().getModel("headerSearchModel").setData({
                employeeQuery: "",
                employeeFilter: "",
                deptQuery: "",
                deptFilter: ""
            });

            this._applyHeaderFilters();
        },

        _setHeaderFilter: function (sType, sValue) {
            var oHeaderModel = this.getView().getModel("headerSearchModel");

            if (sType === "employee") {
                oHeaderModel.setProperty("/employeeQuery", sValue);
                oHeaderModel.setProperty("/employeeFilter", sValue);
            } else {
                oHeaderModel.setProperty("/deptQuery", sValue);
                oHeaderModel.setProperty("/deptFilter", sValue);
            }

            this._applyHeaderFilters();
        },

        _applyHeaderFilters: function () {
            var oCalendar = this.byId("idPlanningCalendar");
            var oBinding = oCalendar && oCalendar.getBinding("rows");

            if (!oBinding) {
                return;
            }

            var oHeaderModel = this.getView().getModel("headerSearchModel");

            var sEmployee = String(
                oHeaderModel.getProperty("/employeeFilter") ||
                oHeaderModel.getProperty("/employeeQuery") ||
                ""
            ).trim();

            var sDept = String(
                oHeaderModel.getProperty("/deptFilter") ||
                oHeaderModel.getProperty("/deptQuery") ||
                ""
            ).trim();

            var aFilters = [];

            if (sEmployee) {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("EmployeeName", FilterOperator.Contains, sEmployee),
                        new Filter("Pernr", FilterOperator.EQ, sEmployee)
                    ], and: false
                }));
            }

            if (sDept) {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("DeptId", FilterOperator.Contains, sDept),
                        new Filter("DeptName", FilterOperator.Contains, sDept)
                    ],
                    and: false
                }));
            }

            oBinding.filter(aFilters);
        },

        onPernrInputValueHelpRequest: function () {
            this._openEmployeeValueHelp("dialog");
        },

        onPernrInputLiveChange: function (oEvent) {
            var oDialogModel = this.getView().getModel("dialogModel");

            oDialogModel.setProperty("/Pernr", oEvent.getParameter("value") || "");
            oDialogModel.setProperty("/EmployeeName", "");
            oDialogModel.setProperty("/DeptName", "");
        },

        _openEmployeeValueHelp: function (sMode) {
            var oEmployeeModel = this.getView().getModel("employeeLookupModel");
            var aEmployees = oEmployeeModel.getProperty("/allEmployees") || [];

            this._sEmployeeValueHelpMode = sMode || "dialog";

            var fnOpen = function () {
                oEmployeeModel.setProperty(
                    "/employees",
                    oEmployeeModel.getProperty("/allEmployees") || []
                );

                this._openFragmentDialog(
                    "pEmployeeDialog",
                    "com.app.zu26g13.app.view.EmployeeValueHelp"
                );
            }.bind(this);

            if (aEmployees.length > 0) {
                fnOpen();
                return;
            }

            sap.ui.core.BusyIndicator.show(0);

            this._loadEmployeeLookup().then(function () {
                sap.ui.core.BusyIndicator.hide();
                fnOpen();
            }).catch(function () {
                sap.ui.core.BusyIndicator.hide();

                MessageBox.error("Unable to load employee list.", {
                    title: "Employee Data Error"
                });
            });
        },

        onEmployeeValueHelpSearch: function (oEvent) {
            this._filterLookupModel(
                "employeeLookupModel",
                "/allEmployees",
                "/employees",
                oEvent.getParameter("value") || "",
                ["Pernr", "EmployeeName", "DeptId", "DeptName"]
            );
        },

        onEmployeeValueHelpConfirm: function (oEvent) {
            var oEmployee = this._getSelectedObject(oEvent, "employeeLookupModel");

            if (!oEmployee) {
                this._resetEmployeeValueHelpList();
                return;
            }

            if (this._sEmployeeValueHelpMode === "headerEmployee") {
                var oHeaderModel = this.getView().getModel("headerSearchModel");
                var sDisplayText = (oEmployee.EmployeeName || "Employee") + " (" + oEmployee.Pernr + ")";

                oHeaderModel.setProperty("/employeeQuery", sDisplayText);
                oHeaderModel.setProperty("/employeeFilter", oEmployee.Pernr);

                this._sEmployeeValueHelpMode = "dialog";
                this._resetEmployeeValueHelpList();
                this._applyHeaderFilters();

                return;
            }

            var oDialogModel = this.getView().getModel("dialogModel");

            oDialogModel.setProperty("/Pernr", oEmployee.Pernr);
            oDialogModel.setProperty("/EmployeeName", oEmployee.EmployeeName || "");
            oDialogModel.setProperty("/DeptId", oEmployee.DeptId || "");
            oDialogModel.setProperty("/DeptName", oEmployee.DeptName || "");

            this._sEmployeeValueHelpMode = "dialog";
            this._resetEmployeeValueHelpList();
        },

        onEmployeeValueHelpCancel: function () {
            this._sEmployeeValueHelpMode = "dialog";
            this._resetEmployeeValueHelpList();
        },

        _resetEmployeeValueHelpList: function () {
            this._resetLookupList("employeeLookupModel", "/allEmployees", "/employees");
        },

        onDeptInputValueHelpRequest: function () {
            this._openDepartmentValueHelp("dialog");
        },

        onDeptInputLiveChange: function (oEvent) {
            var oDialogModel = this.getView().getModel("dialogModel");

            oDialogModel.setProperty("/DeptId", oEvent.getParameter("value") || "");
            oDialogModel.setProperty("/DeptName", "");
        },

        _openDepartmentValueHelp: function (sMode) {
            var oDepartmentModel = this.getView().getModel("departmentLookupModel");
            var aDepartments = oDepartmentModel.getProperty("/allDepartments") || [];

            this._sDepartmentValueHelpMode = sMode || "dialog";

            var fnOpen = function () {
                oDepartmentModel.setProperty(
                    "/departments",
                    oDepartmentModel.getProperty("/allDepartments") || []
                );

                this._openFragmentDialog(
                    "pDepartmentDialog",
                    "com.app.zu26g13.app.view.DepartmentValueHelp"
                );
            }.bind(this);

            if (aDepartments.length > 0) {
                fnOpen();
                return;
            }

            sap.ui.core.BusyIndicator.show(0);

            this._loadDepartmentLookup().then(function () {
                sap.ui.core.BusyIndicator.hide();
                fnOpen();
            }).catch(function () {
                sap.ui.core.BusyIndicator.hide();

                MessageBox.error("Unable to load department list.", {
                    title: "Department Data Error"
                });
            });
        },

        onDepartmentValueHelpSearch: function (oEvent) {
            this._filterLookupModel(
                "departmentLookupModel",
                "/allDepartments",
                "/departments",
                oEvent.getParameter("value") || "",
                ["DeptId", "DeptName"]
            );
        },

        onDepartmentValueHelpConfirm: function (oEvent) {
            var oDepartment = this._getSelectedObject(oEvent, "departmentLookupModel");

            if (!oDepartment) {
                this._resetDepartmentValueHelpList();
                return;
            }

            if (this._sDepartmentValueHelpMode === "headerDepartment") {
                var oHeaderModel = this.getView().getModel("headerSearchModel");
                var sDisplayText = (oDepartment.DeptName || "Department") + " (" + oDepartment.DeptId + ")";

                oHeaderModel.setProperty("/deptQuery", sDisplayText);
                oHeaderModel.setProperty("/deptFilter", oDepartment.DeptId);

                this._sDepartmentValueHelpMode = "dialog";
                this._resetDepartmentValueHelpList();
                this._applyHeaderFilters();

                return;
            }

            var oDialogModel = this.getView().getModel("dialogModel");

            oDialogModel.setProperty("/DeptId", oDepartment.DeptId);
            oDialogModel.setProperty("/DeptName", oDepartment.DeptName || "");

            this._sDepartmentValueHelpMode = "dialog";
            this._resetDepartmentValueHelpList();
        },

        onDepartmentValueHelpCancel: function () {
            this._sDepartmentValueHelpMode = "dialog";
            this._resetDepartmentValueHelpList();
        },

        _resetDepartmentValueHelpList: function () {
            this._resetLookupList("departmentLookupModel", "/allDepartments", "/departments");
        },

        _openFragmentDialog: function (sPropertyName, sFragmentName) {
            var oView = this.getView();

            if (!this[sPropertyName]) {
                this[sPropertyName] = Fragment.load({
                    id: oView.getId(),
                    name: sFragmentName,
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }

            this[sPropertyName].then(function (oDialog) {
                oDialog.open();
            });
        },

        _filterLookupModel: function (sModelName, sAllPath, sFilteredPath, sValue, aFields) {
            var oModel = this.getView().getModel(sModelName);
            var aAllItems = oModel.getProperty(sAllPath) || [];
            var sSearch = String(sValue || "").toLowerCase().trim();

            if (!sSearch) {
                oModel.setProperty(sFilteredPath, aAllItems);
                return;
            }

            var aFiltered = aAllItems.filter(function (item) {
                return aFields.some(function (sField) {
                    return String(item[sField] || "").toLowerCase().indexOf(sSearch) !== -1;
                });
            });

            oModel.setProperty(sFilteredPath, aFiltered);
        },

        _resetLookupList: function (sModelName, sAllPath, sFilteredPath) {
            var oModel = this.getView().getModel(sModelName);

            if (!oModel) {
                return;
            }

            oModel.setProperty(sFilteredPath, oModel.getProperty(sAllPath) || []);
        },

        _getSelectedObject: function (oEvent, sModelName) {
            var oSelectedItem = oEvent.getParameter("selectedItem");

            if (!oSelectedItem) {
                return null;
            }

            var oContext = oSelectedItem.getBindingContext(sModelName);

            return oContext ? oContext.getObject() : null;
        },

        onAssignModeChange: function (oEvent) {
            var sKey = oEvent.getParameter("key");
            var oItem = oEvent.getParameter("item");

            if (!sKey && oItem && oItem.getKey) {
                sKey = oItem.getKey();
            }

            sKey = sKey || "EMP";

            var oDialogModel = this.getView().getModel("dialogModel");

            oDialogModel.setProperty("/AssignMode", sKey);

            if (sKey === "EMP") {
                oDialogModel.setProperty("/DeptId", "");
                oDialogModel.setProperty("/DeptName", "");
            } else {
                oDialogModel.setProperty("/Pernr", "");
                oDialogModel.setProperty("/EmployeeName", "");
                oDialogModel.setProperty("/DeptId", "");
                oDialogModel.setProperty("/DeptName", "");
            }
        },

        onOpenCreateDialog: function () {
            this.getView()
                .getModel("dialogModel")
                .setData(this._getDefaultDialogData());

            this._loadShiftLookup();
            this._openAddOtDialog();
        },

        _openEditDialog: function (oData) {
            if (this._isPastDate(oData.PlanDate)) {
                MessageBox.error(this._getPastDateMessage(oData.PlanDate), {
                    title: "Unable to Edit Past Schedule"
                });
                return;
            }

            this.getView().getModel("dialogModel").setData({
                AssignMode: "EMP",
                Pernr: oData.Pernr,
                EmployeeName: oData.EmployeeName || "",
                DeptId: oData.DeptId || "",
                DeptName: oData.DeptName || "",
                PlanDate: oData.PlanDate,
                StartDate: oData.PlanDate,
                EndDate: oData.PlanDate,
                ShiftId: oData.ShiftId,
                OldShiftId: oData.OldShiftId || oData.ShiftId,
                OtHours: oData.OtHours || "0.00",
                IsOt: parseFloat(oData.OtHours || "0") > 0,
                isEdit: true,
                sEmpShiftPath: oData.sEmpShiftPath,
                sOtPath: oData.sOtPath
            });

            this._loadShiftLookup();
            this._openAddOtDialog();
        },

        _openAddOtDialog: function () {
            this._openFragmentDialog(
                "pDialog",
                "com.app.zu26g13.app.view.AddOtDialog"
            );
        },

        onCloseAddDialog: function () {
            if (this.pDialog) {
                this.pDialog.then(function (oDialog) {
                    oDialog.close();
                });
            }
        },

        onAppointmentSelect: function (oEvent) {
            var oAppointment = oEvent.getParameter("appointment");

            if (!oAppointment) {
                return;
            }

            var oData = oAppointment.getBindingContext("calendarModel").getObject();
            var bPastDate = this._isPastDate(oData.PlanDate);

            var sMessage =
                "Employee ID: " + (oData.DisplayPernr || oData.Pernr) + "\n" +
                "Employee Name: " + (oData.EmployeeName || "") + "\n" +
                "Department: " + (oData.DeptName || oData.DeptId || "N/A") + "\n" +
                "Work Date: " + this._normalizeDate(oData.PlanDate).toLocaleDateString("en-GB") + "\n" +
                "Shift: " + oData.ShiftId + "\n" +
                "Working Time: " + (oData.ShiftTimeText || "") + "\n" +
                "OT Hours: " + oData.OtHours + " hour(s)\n";

            if (bPastDate) {
                sMessage += "\nNote: This date has already passed, so editing or deleting is not allowed.";
            }

            MessageBox.show(sMessage, {
                icon: MessageBox.Icon.INFORMATION,
                title: "Work Schedule Details",
                actions: bPastDate ? ["Close"] : ["Close", "Edit", "Delete"],
                emphasizedAction: "Close",
                onClose: function (sAction) {
                    if (bPastDate) {
                        return;
                    }

                    if (sAction === "Delete") {
                        this._deleteSchedule(oData);
                    } else if (sAction === "Edit") {
                        this._openEditDialog(oData);
                    }
                }.bind(this)
            });
        },

        onSaveOtPlan: function () {
            var oView = this.getView();
            var oODataModel = oView.getModel();
            var oDialogModel = oView.getModel("dialogModel");
            var oDialogData = oDialogModel.getData();
            var fOtHours = parseFloat(oDialogData.OtHours || "0");

            if (isNaN(fOtHours) || fOtHours < 0) {
                MessageBox.error("Invalid OT hours.", {
                    title: "Invalid OT Data"
                });
                return;
            }

            if (!oDialogData.ShiftId) {
                MessageBox.error("Please select a work shift.", {
                    title: "Missing Shift"
                });
                return;
            }

            sap.ui.core.BusyIndicator.show(0);

            if (oDialogData.isEdit) {
                this._handleEditSave(oODataModel, oDialogData, fOtHours);
                return;
            }

            if (oDialogData.AssignMode === "DEPT") {
                this._handleDepartmentCreate(oODataModel, oDialogData, fOtHours);
                return;
            }

            this._handleEmployeeCreate(oODataModel, oDialogModel, oDialogData, fOtHours);
        },

        _handleEditSave: function (oODataModel, oDialogData, fOtHours) {
            if (!oDialogData.Pernr) {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.error("Unable to identify the employee to update.", {
                    title: "Missing Employee"
                });
                return;
            }

            if (this._isPastDate(oDialogData.PlanDate)) {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.error(this._getPastDateMessage(oDialogData.PlanDate), {
                    title: "Unable to Update Past Schedule"
                });
                return;
            }

            this._saveEditSchedule(oODataModel, oDialogData, fOtHours);
        },

        _handleDepartmentCreate: function (oODataModel, oDialogData, fOtHours) {
            if (!oDialogData.DeptId) {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.error("Please select a department.", {
                    title: "Missing Department"
                });
                return;
            }

            this._getEmployeesByDepartment(oDialogData.DeptId).then(function (aEmployees) {
                if (aEmployees.length === 0) {
                    sap.ui.core.BusyIndicator.hide();
                    MessageBox.error("This department has no employees.", {
                        title: "No Employees Found"
                    });
                    return;
                }

                this._saveCreateScheduleForEmployees(
                    oODataModel,
                    oDialogData,
                    fOtHours,
                    aEmployees
                );
            }.bind(this)).catch(function (oError) {
                sap.ui.core.BusyIndicator.hide();

                MessageBox.error(
                    this._getODataErrorMessage(oError, "Unable to load employees by department."),
                    {
                        title: "Department Data Error"
                    }
                );
            }.bind(this));
        },

        _handleEmployeeCreate: function (oODataModel, oDialogModel, oDialogData, fOtHours) {
            if (!oDialogData.Pernr) {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.error("Please select an employee.", {
                    title: "Missing Employee"
                });
                return;
            }

            this._ensureEmployeeExists(oDialogData.Pernr).then(function (oEmployee) {
                oDialogData.Pernr = oEmployee.Pernr;

                oDialogModel.setProperty("/Pernr", oEmployee.Pernr);
                oDialogModel.setProperty("/EmployeeName", oEmployee.EmployeeName || "");
                oDialogModel.setProperty("/DeptId", oEmployee.DeptId || "");
                oDialogModel.setProperty("/DeptName", oEmployee.DeptName || "");

                this._saveCreateScheduleForEmployees(
                    oODataModel,
                    oDialogData,
                    fOtHours,
                    [oEmployee]
                );
            }.bind(this)).catch(function (oError) {
                sap.ui.core.BusyIndicator.hide();

                MessageBox.error(
                    oError && oError.message
                        ? oError.message
                        : "Employee ID does not exist. Please select an employee from value help.",
                    {
                        title: "Invalid Employee"
                    }
                );
            });
        },

        _getEmployeesByDepartment: function (sDeptId) {
            return this._loadEmployeeLookup().then(function () {
                var aEmployees = this.getView()
                    .getModel("employeeLookupModel")
                    .getProperty("/allEmployees") || [];
                var sDept = String(sDeptId || "").trim().toUpperCase();

                return aEmployees.filter(function (item) {
                    return String(item.DeptId || "").trim().toUpperCase() === sDept;
                });
            }.bind(this));
        },

        _saveCreateScheduleForEmployees: function (oODataModel, oDialogData, fOtHours, aEmployees) {
            var dStart = this._normalizeDate(oDialogData.StartDate);
            var dEnd = this._normalizeDate(oDialogData.EndDate);

            if (dStart > dEnd) {
                sap.ui.core.BusyIndicator.hide();

                MessageBox.error("The selected date range is invalid.", {
                    title: "Invalid Date Range"
                });
                return;
            }

            if (this._isPastDate(dStart)) {
                sap.ui.core.BusyIndicator.hide();

                MessageBox.error(
                    "The selected date range contains past dates.\n\n" +
                    "Start Date: " + dStart.toLocaleDateString("en-GB") + "\n" +
                    "Today: " + this._getTodayDateOnly().toLocaleDateString("en-GB") + "\n\n" +
                    "Please select today or a future date.",
                    {
                        title: "Unable to Create Schedule for Past Date"
                    }
                );
                return;
            }

            var aDates = this._buildDateRange(dStart, dEnd);

            this._confirmNonWorkingDateStrategy(aDates).then(function (aFinalDates) {
                if (!aFinalDates || aFinalDates.length === 0) {
                    sap.ui.core.BusyIndicator.hide();
                    return;
                }

                this._executeCreateScheduleForDates(
                    oODataModel,
                    oDialogData,
                    fOtHours,
                    aEmployees,
                    aFinalDates
                );
            }.bind(this)).catch(function (oError) {
                sap.ui.core.BusyIndicator.hide();

                if (oError && oError.cancelled) {
                    return;
                }

                MessageBox.error(
                    this._getODataErrorMessage(oError, "Unable to check non-working dates or holidays."),
                    {
                        title: "Non-working Date Check Error"
                    }
                );
            }.bind(this));
        },

        _confirmNonWorkingDateStrategy: function (aDates) {
            return this._getNonWorkingDates(aDates).then(function (aNonWorkingDates) {
                if (aNonWorkingDates.length === 0) {
                    return aDates;
                }

                sap.ui.core.BusyIndicator.hide();

                var sDateList = aNonWorkingDates.map(function (item) {
                    return "- " + item.DateText + ": " + item.Reason;
                }).join("\n");

                return new Promise(function (resolve, reject) {
                    MessageBox.confirm(
                        "The selected date range contains Sundays or holidays:\n\n" +
                        sDateList + "\n\n" +
                        "Do you want to create schedules for these dates?",
                        {
                            title: "Confirm Non-working Date Schedule",
                            actions: [
                                "Create Including Days Off",
                                "Skip Days Off",
                                MessageBox.Action.CANCEL
                            ],
                            emphasizedAction: "Create Including Days Off",
                            onClose: function (sAction) {
                                if (sAction === MessageBox.Action.CANCEL) {
                                    reject({
                                        cancelled: true
                                    });
                                    return;
                                }

                                if (sAction === "Create Including Days Off") {
                                    sap.ui.core.BusyIndicator.show(0);
                                    resolve(aDates);
                                    return;
                                }

                                var mSkipDates = {};

                                aNonWorkingDates.forEach(function (item) {
                                    mSkipDates[item.DateKey] = true;
                                });

                                var aFinalDates = aDates.filter(function (dDate) {
                                    return !mSkipDates[this._dateKey(dDate)];
                                }.bind(this));

                                if (aFinalDates.length === 0) {
                                    MessageBox.error(
                                        "All selected dates are Sundays or holidays. There are no regular working days to schedule.",
                                        {
                                            title: "No Valid Working Dates"
                                        }
                                    );

                                    reject({
                                        cancelled: true
                                    });
                                    return;
                                }

                                sap.ui.core.BusyIndicator.show(0);
                                resolve(aFinalDates);
                            }.bind(this)
                        }
                    );
                }.bind(this));
            }.bind(this));
        },

        _executeCreateScheduleForDates: function (oODataModel, oDialogData, fOtHours, aEmployees, aDates) {
            var pChain = Promise.resolve();

            aEmployees.forEach(function (oEmployee) {
                aDates.forEach(function (dWorkDate) {
                    pChain = pChain.then(function () {
                        if (this._isPastDate(dWorkDate)) {
                            return Promise.reject({
                                message: this._getPastDateMessage(dWorkDate)
                            });
                        }

                        return this._createEmpShiftIfNotExists(
                            oODataModel,
                            oEmployee.Pernr,
                            dWorkDate,
                            oDialogData.ShiftId
                        );
                    }.bind(this)).then(function () {
                        if (fOtHours > 0) {
                            return this._upsertOtPlan(oODataModel, {
                                Pernr: oEmployee.Pernr,
                                PlanDate: this._toODataDate(dWorkDate),
                                ShiftId: oDialogData.ShiftId,
                                OtHours: fOtHours.toFixed(2),
                                IsOt: true
                            });
                        }

                        return Promise.resolve();
                    }.bind(this));
                }.bind(this));
            }.bind(this));

            pChain.then(function () {
                sap.ui.core.BusyIndicator.hide();

                MessageBox.success("Work schedule has been created successfully.");
                this.onCloseAddDialog();
                this._publishDataChanged("Schedule", "create");
                this._reloadAllScheduleData();
            }.bind(this)).catch(function (oError) {
                sap.ui.core.BusyIndicator.hide();

                MessageBox.error(
                    this._getODataErrorMessage(oError, "An error occurred while saving the work schedule or OT data."),
                    {
                        title: "Unable to Save Schedule"
                    }
                );
            }.bind(this));
        },

        _saveEditSchedule: function (oODataModel, oDialogData, fOtHours) {
            var dWorkDate = this._normalizeDate(oDialogData.PlanDate);
            var dODataWorkDate = this._toODataDate(dWorkDate);

            if (this._isPastDate(dWorkDate)) {
                sap.ui.core.BusyIndicator.hide();

                MessageBox.error(this._getPastDateMessage(dWorkDate), {
                    title: "Unable to Update Past Schedule"
                });
                return;
            }

            var pSaveShift = Promise.resolve();

            if (oDialogData.OldShiftId && oDialogData.OldShiftId !== oDialogData.ShiftId) {
                var sOldPath = this._buildEmpShiftPath(
                    oODataModel,
                    oDialogData.Pernr,
                    dWorkDate,
                    oDialogData.OldShiftId
                );

                pSaveShift = this._deletePath(oODataModel, sOldPath, true).then(function () {
                    return this._createEmpShift(oODataModel, {
                        Pernr: oDialogData.Pernr,
                        WorkDate: dODataWorkDate,
                        ShiftId: oDialogData.ShiftId
                    });
                }.bind(this));
            }

            pSaveShift.then(function () {
                if (fOtHours > 0) {
                    return this._upsertOtPlan(oODataModel, {
                        Pernr: oDialogData.Pernr,
                        PlanDate: this._toODataDate(dWorkDate),
                        ShiftId: oDialogData.ShiftId,
                        OtHours: fOtHours.toFixed(2),
                        IsOt: true
                    });
                }

                return this._removeOtPlanByKey(
                    oODataModel,
                    oDialogData.Pernr,
                    dWorkDate
                );
            }.bind(this)).then(function () {
                sap.ui.core.BusyIndicator.hide();

                MessageBox.success("Work schedule has been updated successfully.");
                this.onCloseAddDialog();
                this._publishDataChanged("Schedule", "update");
                this._reloadAllScheduleData();
            }.bind(this)).catch(function (oError) {
                sap.ui.core.BusyIndicator.hide();

                MessageBox.error(
                    this._getODataErrorMessage(oError, "An error occurred while updating the work schedule."),
                    {
                        title: "Unable to Update Schedule"
                    }
                );
            }.bind(this));
        },

        _deleteSchedule: function (oData) {
            if (this._isPastDate(oData.WorkDate || oData.PlanDate)) {
                MessageBox.error(this._getPastDateMessage(oData.WorkDate || oData.PlanDate), {
                    title: "Unable to Delete Past Schedule"
                });
                return;
            }

            var oODataModel = this.getView().getModel();

            sap.ui.core.BusyIndicator.show(0);

            var pDeleteShift = Promise.resolve();

            if (oData.Pernr && oData.WorkDate && oData.ShiftId) {
                pDeleteShift = this._deletePath(
                    oODataModel,
                    this._buildEmpShiftPath(
                        oODataModel,
                        oData.Pernr,
                        oData.WorkDate,
                        oData.ShiftId
                    ),
                    false
                );
            }

            pDeleteShift.then(function () {
                return this._readEmpShiftByDate(
                    oODataModel,
                    oData.Pernr,
                    oData.WorkDate
                );
            }.bind(this)).then(function (aRemaining) {
                if (aRemaining.length === 0) {
                    return this._removeOtPlanByKey(
                        oODataModel,
                        oData.Pernr,
                        oData.WorkDate || oData.PlanDate
                    );
                }

                return Promise.resolve();
            }.bind(this)).then(function () {
                sap.ui.core.BusyIndicator.hide();

                MessageBox.success("Work schedule has been deleted successfully.");
                this._publishDataChanged("Schedule", "delete");
                this._reloadAllScheduleData();
            }.bind(this)).catch(function (oError) {
                sap.ui.core.BusyIndicator.hide();

                MessageBox.error(
                    this._getODataErrorMessage(oError, "An error occurred while deleting the work schedule."),
                    {
                        title: "Unable to Delete Schedule"
                    }
                );
            }.bind(this));
        },

        _readSet: function (sPath, mParameters) {
            var oODataModel = this.getView().getModel();

            return new Promise(function (resolve, reject) {
                oODataModel.read(sPath, Object.assign({
                    success: function (oData) {
                        resolve(oData.results || []);
                    },
                    error: function (oError) {
                        reject(oError);
                    }
                }, mParameters || {}));
            });
        },

        _createEmpShiftIfNotExists: function (oODataModel, sPernr, dWorkDate, sShiftId) {
            return this._readEmpShiftByDate(
                oODataModel,
                sPernr,
                dWorkDate
            ).then(function (aExisting) {
                if (aExisting.length > 0) {
                    return Promise.reject({
                        message: "Employee " + sPernr +
                            " already has shift " + (aExisting[0].ShiftId || "") +
                            " on " + this._normalizeDate(dWorkDate).toLocaleDateString("en-GB") +
                            ". Please edit the existing schedule instead of creating a new one."
                    });
                }

                return this._createEmpShift(oODataModel, {
                    Pernr: sPernr,
                    WorkDate: this._toODataDate(dWorkDate),
                    ShiftId: sShiftId
                });
            }.bind(this));
        },

        _readEmpShiftByDate: function (oODataModel, sPernr, dWorkDate) {
            return new Promise(function (resolve, reject) {
                oODataModel.read("/EmpShift", {
                    filters: [
                        new Filter("Pernr", FilterOperator.EQ, sPernr),
                        new Filter("WorkDate", FilterOperator.EQ, this._toODataDate(dWorkDate))
                    ],
                    success: function (oData) {
                        resolve(oData.results || []);
                    },
                    error: function (oError) {
                        reject(oError);
                    }
                });
            }.bind(this));
        },

        _createEmpShift: function (oODataModel, oPayload) {
            return new Promise(function (resolve, reject) {
                oODataModel.create("/EmpShift", oPayload, {
                    success: function () {
                        resolve();
                    },
                    error: function (oError) {
                        reject(oError);
                    }
                });
            });
        },

        _readOtPlanByDate: function (oODataModel, sPernr, dPlanDate) {
            return new Promise(function (resolve, reject) {
                oODataModel.read("/OtPlan", {
                    filters: [
                        new Filter("Pernr", FilterOperator.EQ, sPernr),
                        new Filter("PlanDate", FilterOperator.EQ, this._toODataDate(dPlanDate))
                    ],
                    success: function (oData) {
                        resolve(oData.results || []);
                    },
                    error: function (oError) {
                        reject(oError);
                    }
                });
            }.bind(this));
        },

        _upsertOtPlan: function (oODataModel, oPayload) {
            return this._readOtPlanByDate(
                oODataModel,
                oPayload.Pernr,
                oPayload.PlanDate
            ).then(function (aOtPlan) {
                if (aOtPlan && aOtPlan.length > 0) {
                    var oExistingOt = aOtPlan[0];

                    var sUpdatePath = oODataModel.createKey("/OtPlan", {
                        Pernr: oExistingOt.Pernr || oPayload.Pernr,
                        PlanDate: this._toODataDate(this._toDate(oExistingOt.PlanDate || oPayload.PlanDate))
                    });

                    var oUpdatePayload = {
                        ShiftId: oPayload.ShiftId,
                        OtHours: oPayload.OtHours,
                        IsOt: oPayload.IsOt
                    };

                    return new Promise(function (resolve, reject) {
                        oODataModel.update(sUpdatePath, oUpdatePayload, {
                            success: function () {
                                resolve();
                            },
                            error: function (oError) {
                                reject(oError);
                            }
                        });
                    });
                }

                var oCreatePayload = {
                    Pernr: oPayload.Pernr,
                    PlanDate: this._toODataDate(oPayload.PlanDate),
                    ShiftId: oPayload.ShiftId,
                    OtHours: oPayload.OtHours,
                    IsOt: oPayload.IsOt
                };

                return new Promise(function (resolve, reject) {
                    oODataModel.create("/OtPlan", oCreatePayload, {
                        success: function () {
                            resolve();
                        },
                        error: function (oError) {
                            reject(oError);
                        }
                    });
                });
            }.bind(this));
        },

        _removeOtPlanByKey: function (oODataModel, sPernr, dPlanDate) {
            return this._readOtPlanByDate(
                oODataModel,
                sPernr,
                dPlanDate
            ).then(function (aOtPlan) {
                if (!aOtPlan || aOtPlan.length === 0) {
                    return Promise.resolve();
                }

                var oOtPlan = aOtPlan[0];

                var sPath = oODataModel.createKey("/OtPlan", {
                    Pernr: oOtPlan.Pernr || sPernr,
                    PlanDate: this._toODataDate(this._toDate(oOtPlan.PlanDate || dPlanDate))
                });

                return this._deletePath(oODataModel, sPath, true);
            }.bind(this));
        },

        _deletePath: function (oODataModel, sPath, bIgnoreNotFound) {
            return new Promise(function (resolve, reject) {
                if (!sPath) {
                    resolve();
                    return;
                }

                oODataModel.remove(sPath, {
                    success: function () {
                        resolve();
                    },
                    error: function (oError) {
                        var iStatusCode = Number(oError && oError.statusCode);

                        if (bIgnoreNotFound && iStatusCode === 404) {
                            resolve();
                            return;
                        }

                        reject(oError);
                    }
                });
            });
        },

        _ensureEmployeeExists: function (sPernr) {
            var oEmployee = this._findEmployeeByPernr(sPernr);

            if (oEmployee) {
                return Promise.resolve(oEmployee);
            }

            return this._loadEmployeeLookup().then(function () {
                var oFound = this._findEmployeeByPernr(sPernr);

                if (oFound) {
                    return oFound;
                }

                return Promise.reject({
                    message: "Employee ID " + sPernr + " does not exist in employee master. Please select an employee from value help."
                });
            }.bind(this));
        },

        _findEmployeeByPernr: function (sPernr) {
            var oEmployeeModel = this.getView().getModel("employeeLookupModel");
            var aEmployees = oEmployeeModel ? oEmployeeModel.getProperty("/allEmployees") || [] : [];
            var sInput = this._normalizePernrForCompare(sPernr);

            for (var i = 0; i < aEmployees.length; i++) {
                if (this._normalizePernrForCompare(aEmployees[i].Pernr) === sInput) {
                    return aEmployees[i];
                }
            }

            return null;
        },

        _normalizePernrForCompare: function (vPernr) {
            var sPernr = String(vPernr || "").trim();

            if (!sPernr) {
                return "";
            }

            sPernr = sPernr.replace(/^0+/, "");

            return sPernr || "0";
        },

        _getNonWorkingDates: function (aDates) {
            return this._loadHolidayMap().then(function (mHolidayMap) {
                var aResult = [];

                aDates.forEach(function (dDate) {
                    var sDateKey = this._dateKey(dDate);
                    var aReasons = [];

                    if (this._isSunday(dDate)) {
                        aReasons.push("Sunday");
                    }

                    if (mHolidayMap[sDateKey]) {
                        aReasons.push("Holiday: " + mHolidayMap[sDateKey]);
                    }

                    if (aReasons.length > 0) {
                        aResult.push({
                            Date: dDate,
                            DateKey: sDateKey,
                            DateText: dDate.toLocaleDateString("en-GB"),
                            Reason: aReasons.join(", ")
                        });
                    }
                }.bind(this));

                return aResult;
            }.bind(this));
        },

        _loadHolidayMap: function () {
            return this._readSet("/Holiday").then(function (aHolidays) {
                var mHolidayMap = {};

                aHolidays.forEach(function (item) {
                    var dHolDate = this._toDate(item.HolDate);
                    var sDateKey = this._dateKey(dHolDate);

                    mHolidayMap[sDateKey] = item.HolDesc || "Holiday";
                }.bind(this));

                return mHolidayMap;
            }.bind(this)).catch(function () {
                return {};
            });
        },

        _isSunday: function (vDate) {
            return this._normalizeDate(vDate).getDay() === 0;
        },

        _buildDateRange: function (dStart, dEnd) {
            var aDates = [];
            var dCurrent = new Date(dStart);

            while (dCurrent <= dEnd) {
                aDates.push(this._normalizeDate(dCurrent));
                dCurrent.setDate(dCurrent.getDate() + 1);
            }

            return aDates;
        },

        _getTodayDateOnly: function () {
            var dToday = new Date();
            dToday.setHours(0, 0, 0, 0);
            return dToday;
        },

        _isPastDate: function (vDate) {
            return this._normalizeDate(vDate) < this._getTodayDateOnly();
        },

        _getPastDateMessage: function (vDate) {
            return "Date " + this._normalizeDate(vDate).toLocaleDateString("en-GB") +
                " has already passed. Creating, editing, or deleting work schedules for past dates is not allowed.";
        },

        _toODataDate: function (vDate) {
            var dDate = this._normalizeDate(vDate);

            return new Date(Date.UTC(
                dDate.getFullYear(),
                dDate.getMonth(),
                dDate.getDate(),
                0,
                0,
                0
            ));
        },

        _buildEmpShiftPath: function (oODataModel, sPernr, vWorkDate, sShiftId) {
            return oODataModel.createKey("/EmpShift", {
                Pernr: sPernr,
                WorkDate: this._toODataDate(vWorkDate),
                ShiftId: sShiftId
            });
        },

        _normalizeDate: function (vDate) {
            var dDate = new Date(vDate);
            dDate.setHours(0, 0, 0, 0);
            return dDate;
        },

        _toDate: function (vDate) {
            if (!vDate) {
                return new Date();
            }

            if (vDate instanceof Date) {
                return vDate;
            }

            if (typeof vDate === "string" && vDate.indexOf("/Date(") === 0) {
                return new Date(parseInt(vDate.replace(/\D/g, ""), 10));
            }

            return new Date(vDate);
        },

        _dateKey: function (vDate) {
            var dDate = this._normalizeDate(vDate);

            return dDate.getFullYear() + "-" +
                String(dDate.getMonth() + 1).padStart(2, "0") + "-" +
                String(dDate.getDate()).padStart(2, "0");
        },

        _getHoursMinutes: function (vTime) {
            if (!vTime) {
                return {
                    hours: 0,
                    minutes: 0
                };
            }

            if (typeof vTime === "object" && vTime.ms !== undefined) {
                var iTotalSeconds = Math.floor(vTime.ms / 1000);

                return {
                    hours: Math.floor(iTotalSeconds / 3600),
                    minutes: Math.floor((iTotalSeconds % 3600) / 60)
                };
            }

            var sTime = String(vTime);
            var aMatch = sTime.match(/^PT(\d+)H(\d+)M/);

            if (aMatch) {
                return {
                    hours: parseInt(aMatch[1], 10),
                    minutes: parseInt(aMatch[2], 10)
                };
            }

            if (/^\d{6}$/.test(sTime)) {
                return {
                    hours: parseInt(sTime.substring(0, 2), 10),
                    minutes: parseInt(sTime.substring(2, 4), 10)
                };
            }

            if (/^\d{2}:\d{2}:\d{2}$/.test(sTime)) {
                return {
                    hours: parseInt(sTime.substring(0, 2), 10),
                    minutes: parseInt(sTime.substring(3, 5), 10)
                };
            }

            return {
                hours: 0,
                minutes: 0
            };
        },

        _formatTime: function (vTime) {
            var oTime = this._getHoursMinutes(vTime);

            return String(oTime.hours).padStart(2, "0") + ":" +
                String(oTime.minutes).padStart(2, "0");
        },

        formatAppointmentType: function (sShiftId, sOtHours) {
            var fOt = parseFloat(sOtHours || "0");
            var sShift = String(sShiftId || "").toUpperCase();

            if (fOt > 0) {
                return sap.ui.unified.CalendarDayType.Type01;
            }

            if (sShift === "CA_01") {
                return sap.ui.unified.CalendarDayType.Type08;
            }

            if (sShift === "CA_02") {
                return sap.ui.unified.CalendarDayType.Type06;
            }

            if (sShift === "CA_03") {
                return sap.ui.unified.CalendarDayType.Type07;
            }

            return sap.ui.unified.CalendarDayType.Type09;
        },

        _getODataErrorMessage: function (oError, sDefaultMessage) {
            var aMessages = [];

            var fnAddMessage = function (sMessage) {
                sMessage = String(sMessage || "").trim();

                if (!sMessage || sMessage === "HTTP request failed") {
                    return;
                }

                if (aMessages.indexOf(sMessage) === -1) {
                    aMessages.push(sMessage);
                }
            };

            try {
                if (oError && oError.responseText) {
                    var oBody = JSON.parse(oError.responseText);

                    if (
                        oBody &&
                        oBody.error &&
                        oBody.error.innererror &&
                        oBody.error.innererror.errordetails &&
                        oBody.error.innererror.errordetails.length
                    ) {
                        oBody.error.innererror.errordetails.forEach(function (item) {
                            fnAddMessage(item.message);
                        });
                    }

                    if (
                        oBody &&
                        oBody.error &&
                        oBody.error.message &&
                        oBody.error.message.value
                    ) {
                        fnAddMessage(oBody.error.message.value);
                    }
                }
            } catch (e) {
                if (oError && oError.responseText) {
                    fnAddMessage(oError.responseText);
                }
            }

            if (oError && oError.message) {
                fnAddMessage(oError.message);
            }

            return aMessages.length > 0
                ? aMessages.join("\n")
                : sDefaultMessage || "An unexpected error occurred.";
        }

    });
});