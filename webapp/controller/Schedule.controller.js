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

            this._initModels();

            // Auto-reload data when routing to this page
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("schedule").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function () {
            this._loadShiftLookup();
            this._loadCalendarData();
        },

        onAfterRendering: function () {
            this._installHideMonthsOption();
        },

        onExit: function () {
            jQuery(document).off(".hidePlanningCalendarMonths");
        },

        _initModels: function () {
            this.getView().setModel(new JSONModel({
                employees: []
            }), "calendarModel");

            this.getView().setModel(new JSONModel({
                shifts: []
            }), "shiftLookupModel");

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

        // =========================================================
        // UI HACKS (Hide 'Months' view from PlanningCalendar)
        // =========================================================
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
                if (oItem.text().trim() === "Months") {
                    oItem.hide();
                    oItem.attr("aria-hidden", "true");
                }
            });
        },

        // =========================================================
        // DATA LOADING & CALENDAR BUILDING
        // =========================================================
        _loadCalendarData: function () {
            var oCalendarModel = this.getView().getModel("calendarModel");
            var oODataModel = this.getView().getModel();

            sap.ui.core.BusyIndicator.show(0);

            // Using Promise.all to fetch EmpShift, OtPlan and Employee Master simultaneously (HEAD version resolved)
            Promise.all([
                this._readSet("/EmpShift"),
                this._readSet("/OtPlan").catch(function () { return []; }),
                this._readSet("/Employee").catch(function () { return []; })
            ]).then(function (aResult) {
                var aEmpShift = aResult[0] || [];
                var aOtPlan = aResult[1] || [];
                var aEmployees = aResult[2] || [];
                
                var mEmployeeByPernr = this._buildEmployeeMap(aEmployees);
                var aCalendarEmployees = this._buildCalendarEmployees(aEmpShift, aOtPlan, oODataModel, mEmployeeByPernr);

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
                ), { title: "Unable to Load Schedule" });
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
                var oEmployeeMaster = mEmployeeByPernr ? mEmployeeByPernr[sPernrKey] : null;

                var sDisplayPernr = oEmployeeMaster && oEmployeeMaster.Pernr ? oEmployeeMaster.Pernr : item.Pernr;
                var sEmployeeName = oEmployeeMaster && oEmployeeMaster.Ename ? oEmployeeMaster.Ename : item.EmployeeName || "Unknown Employee";
                var sDeptId = oEmployeeMaster && oEmployeeMaster.DeptId ? oEmployeeMaster.DeptId : item.DeptId || "";
                var sDeptName = oEmployeeMaster && oEmployeeMaster.DeptName ? oEmployeeMaster.DeptName : item.DeptName || "";

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

            if (!oODataModel) return;

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
                }.bind(this)
            });
        },

        // =========================================================
        // UNIFIED SEARCH HELP (POPOVER) FOR EMPLOYEE & DEPARTMENT
        // =========================================================
        
        onHeaderEmployeeValueHelpRequest: function (oEvent) {
            this._sValueHelpContext = "HEADER";
            this._oCurrentInput = oEvent.getSource();
            this._openEmployeePopover();
        },

        onPernrInputValueHelpRequest: function (oEvent) {
            this._sValueHelpContext = "DIALOG";
            this._oCurrentInput = oEvent.getSource();
            this._openEmployeePopover();
        },

        _openEmployeePopover: function () {
            var oView = this.getView();
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
                oPopover.openBy(this._oCurrentInput);
            }.bind(this));
        },

        onEmployeeValueHelpSearch: function (oEvent) {
            var sValue = oEvent.getParameter("value") || oEvent.getParameter("newValue");
            var oFilterName = new Filter("Ename", FilterOperator.Contains, sValue);
            var oFilterId = new Filter("Pernr", FilterOperator.Contains, sValue);
            this.byId("empValueHelpList").getBinding("items").filter([
                new Filter({ filters: [oFilterName, oFilterId], and: false })
            ]);
        },

        onEmployeeValueHelpConfirm: function (oEvent) {
            var oItem = oEvent.getParameter("listItem");
            if (oItem && this._oCurrentInput) {
                var sPernr = oItem.getDescription();
                var sEname = oItem.getTitle();

                this._oCurrentInput.setValue(sPernr);

                if (this._sValueHelpContext === "HEADER") {
                    this._setHeaderFilter("employee", sPernr);
                } else {
                    var oDialogModel = this.getView().getModel("dialogModel");
                    oDialogModel.setProperty("/Pernr", sPernr);
                    oDialogModel.setProperty("/EmployeeName", sEname);
                }
                this._pEmpValueHelpDialog.then(function (oPopover) { oPopover.close(); });
            }
        },

        onEmployeeValueHelpCancel: function () {
            if (this._pEmpValueHelpDialog) {
                this._pEmpValueHelpDialog.then(function (oPopover) { oPopover.close(); });
            }
        },

        onHeaderDepartmentValueHelpRequest: function (oEvent) {
            this._sValueHelpContext = "HEADER";
            this._oCurrentInput = oEvent.getSource();
            this._openDepartmentPopover();
        },

        onDeptInputValueHelpRequest: function (oEvent) {
            this._sValueHelpContext = "DIALOG";
            this._oCurrentInput = oEvent.getSource();
            this._openDepartmentPopover();
        },

        _openDepartmentPopover: function () {
            var oView = this.getView();
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
                oPopover.openBy(this._oCurrentInput);
            }.bind(this));
        },

        onDeptValueHelpSearch: function (oEvent) {
            var sValue = oEvent.getParameter("value") || oEvent.getParameter("newValue");
            var oFilterName = new Filter("DeptName", FilterOperator.Contains, sValue);
            var oFilterId = new Filter("DeptId", FilterOperator.Contains, sValue);
            this.byId("deptValueHelpList").getBinding("items").filter([
                new Filter({ filters: [oFilterName, oFilterId], and: false })
            ]);
        },

        onDeptValueHelpConfirm: function (oEvent) {
            var oItem = oEvent.getParameter("listItem");
            if (oItem && this._oCurrentInput) {
                var sDeptId = oItem.getDescription();
                var sDeptName = oItem.getTitle();

                this._oCurrentInput.setValue(sDeptId);

                if (this._sValueHelpContext === "HEADER") {
                    this._setHeaderFilter("department", sDeptId);
                } else {
                    var oDialogModel = this.getView().getModel("dialogModel");
                    oDialogModel.setProperty("/DeptId", sDeptId);
                    oDialogModel.setProperty("/DeptName", sDeptName);
                }
                this._pDeptValueHelpDialog.then(function (oPopover) { oPopover.close(); });
            }
        },

        onDeptValueHelpCancel: function () {
            if (this._pDeptValueHelpDialog) {
                this._pDeptValueHelpDialog.then(function (oPopover) { oPopover.close(); });
            }
        },

        // =========================================================
        // HEADER FILTER LOGIC (Live Search)
        // =========================================================
        onHeaderEmployeeLiveChange: function (oEvent) {
            this._setHeaderFilter("employee", oEvent.getParameter("value") || oEvent.getParameter("newValue") || "");
        },
        onHeaderEmployeeSubmit: function (oEvent) {
            this._setHeaderFilter("employee", oEvent.getParameter("value") || "");
        },
        onHeaderDepartmentLiveChange: function (oEvent) {
            this._setHeaderFilter("department", oEvent.getParameter("value") || oEvent.getParameter("newValue") || "");
        },
        onHeaderDepartmentSubmit: function (oEvent) {
            this._setHeaderFilter("department", oEvent.getParameter("value") || "");
        },

        onClearHeaderFilters: function () {
            this.getView().getModel("headerSearchModel").setData({
                employeeQuery: "", employeeFilter: "",
                deptQuery: "", deptFilter: ""
            });
            
            // Clear inputs visually if bound
            var oEmpInput = this.byId("HeaderEmployeeSearchInput");
            if (oEmpInput) oEmpInput.setValue("");
            var oDeptInput = this.byId("HeaderDepartmentSearchInput");
            if (oDeptInput) oDeptInput.setValue("");

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
            if (!oBinding) return;

            var oHeaderModel = this.getView().getModel("headerSearchModel");
            var sEmployee = String(oHeaderModel.getProperty("/employeeFilter") || oHeaderModel.getProperty("/employeeQuery") || "").trim();
            var sDept = String(oHeaderModel.getProperty("/deptFilter") || oHeaderModel.getProperty("/deptQuery") || "").trim();
            var aFilters = [];

            if (sEmployee) {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("EmployeeName", FilterOperator.Contains, sEmployee),
                        new Filter("Pernr", FilterOperator.Contains, sEmployee)
                    ], and: false
                }));
            }
            if (sDept) {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("DeptId", FilterOperator.Contains, sDept),
                        new Filter("DeptName", FilterOperator.Contains, sDept)
                    ], and: false
                }));
            }

            oBinding.filter(aFilters);
        },

        // =========================================================
        // CRUD LOGIC (DIALOG)
        // =========================================================
        onAssignModeChange: function (oEvent) {
            var sKey = oEvent.getParameter("key") || oEvent.getParameter("item").getKey() || "EMP";
            var oDialogModel = this.getView().getModel("dialogModel");
            oDialogModel.setProperty("/AssignMode", sKey);

            if (sKey === "EMP") {
                oDialogModel.setProperty("/DeptId", "");
                oDialogModel.setProperty("/DeptName", "");
            } else {
                oDialogModel.setProperty("/Pernr", "");
                oDialogModel.setProperty("/EmployeeName", "");
            }
        },

        onOpenCreateDialog: function () {
            this.getView().getModel("dialogModel").setData(this._getDefaultDialogData());
            this._loadShiftLookup();
            
            if (!this.pDialog) {
                this.pDialog = Fragment.load({
                    id: this.getView().getId(),
                    name: "com.app.zu26g13.app.view.AddOtDialog",
                    controller: this
                }).then(function (oDialog) {
                    this.getView().addDependent(oDialog);
                    return oDialog;
                }.bind(this));
            }

            this.pDialog.then(function (oDialog) {
                oDialog.open();
            });
        },

        _openEditDialog: function (oData) {
            if (this._isPastDate(oData.PlanDate)) {
                MessageBox.error(this._getPastDateMessage(oData.PlanDate), { title: "Unable to Edit Past Schedule" });
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
            if (!this.pDialog) {
                this.pDialog = Fragment.load({
                    id: this.getView().getId(),
                    name: "com.app.zu26g13.app.view.AddOtDialog",
                    controller: this
                }).then(function (oDialog) {
                    this.getView().addDependent(oDialog);
                    return oDialog;
                }.bind(this));
            }

            this.pDialog.then(function (oDialog) {
                oDialog.open();
            });
        },

        onCloseAddDialog: function () {
            if (this.pDialog) {
                this.pDialog.then(function (oDialog) { oDialog.close(); });
            }
        },

        onAppointmentSelect: function (oEvent) {
            var oAppointment = oEvent.getParameter("appointment");
            if (!oAppointment) return;

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

            if (bPastDate) sMessage += "\nNote: This date has already passed, editing or deleting is not allowed.";

            MessageBox.show(sMessage, {
                icon: MessageBox.Icon.INFORMATION,
                title: "Work Schedule Details",
                actions: bPastDate ? ["Close"] : ["Close", "Edit", "Delete"],
                emphasizedAction: "Close",
                onClose: function (sAction) {
                    if (bPastDate) return;
                    if (sAction === "Delete") this._deleteSchedule(oData);
                    else if (sAction === "Edit") this._openEditDialog(oData);
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
                MessageBox.error("Invalid OT hours.", { title: "Invalid OT Data" });
                return;
            }

            if (!oDialogData.ShiftId) {
                MessageBox.error("Please select a work shift.", { title: "Missing Shift" });
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
                MessageBox.error("Unable to identify the employee to update.", { title: "Missing Employee" });
                return;
            }

            if (this._isPastDate(oDialogData.PlanDate)) {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.error(this._getPastDateMessage(oDialogData.PlanDate), { title: "Unable to Update Past Schedule" });
                return;
            }

            this._saveEditSchedule(oODataModel, oDialogData, fOtHours);
        },

        _handleDepartmentCreate: function (oODataModel, oDialogData, fOtHours) {
            if (!oDialogData.DeptId) {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.error("Please select a department.", { title: "Missing Department" });
                return;
            }

            this._getEmployeesByDepartment(oDialogData.DeptId).then(function (aEmployees) {
                if (aEmployees.length === 0) {
                    sap.ui.core.BusyIndicator.hide();
                    MessageBox.error("This department has no employees.", { title: "No Employees Found" });
                    return;
                }
                this._saveCreateScheduleForEmployees(oODataModel, oDialogData, fOtHours, aEmployees);
            }.bind(this)).catch(function (oError) {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.error(this._getODataErrorMessage(oError, "Unable to load employees by department."));
            }.bind(this));
        },

        _handleEmployeeCreate: function (oODataModel, oDialogModel, oDialogData, fOtHours) {
            if (!oDialogData.Pernr) {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.error("Please select an employee.", { title: "Missing Employee" });
                return;
            }

            this._ensureEmployeeExists(oDialogData.Pernr).then(function (oEmployee) {
                oDialogData.Pernr = oEmployee.Pernr;
                oDialogModel.setProperty("/Pernr", oEmployee.Pernr);
                oDialogModel.setProperty("/EmployeeName", oEmployee.Ename || "");
                oDialogModel.setProperty("/DeptId", oEmployee.DeptId || "");

                this._saveCreateScheduleForEmployees(oODataModel, oDialogData, fOtHours, [oEmployee]);
            }.bind(this)).catch(function (oError) {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.error(
                    oError && oError.message ? oError.message : "Employee ID does not exist. Please select from value help.",
                    { title: "Invalid Employee" }
                );
            });
        },

        _getEmployeesByDepartment: function (sDeptId) {
            return this._readSet("/Employee", {
                filters: [new Filter("DeptId", FilterOperator.EQ, sDeptId)]
            });
        },

        _ensureEmployeeExists: function (sPernr) {
            return this._readSet("/Employee", {
                filters: [new Filter("Pernr", FilterOperator.EQ, sPernr)]
            }).then(function (aRes) {
                if (aRes && aRes.length > 0) return aRes[0];
                return Promise.reject({ message: "Employee ID " + sPernr + " does not exist." });
            });
        },

        _saveCreateScheduleForEmployees: function (oODataModel, oDialogData, fOtHours, aEmployees) {
            var dStart = this._normalizeDate(oDialogData.StartDate);
            var dEnd = this._normalizeDate(oDialogData.EndDate);

            if (dStart > dEnd) {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.error("The selected date range is invalid.", { title: "Invalid Date Range" });
                return;
            }

            if (this._isPastDate(dStart)) {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.error(
                    "The selected date range contains past dates.\n\n" +
                    "Start Date: " + dStart.toLocaleDateString("en-GB") + "\n" +
                    "Please select today or a future date.",
                    { title: "Unable to Create Schedule" }
                );
                return;
            }

            var aDates = this._buildDateRange(dStart, dEnd);

            this._confirmNonWorkingDateStrategy(aDates).then(function (aFinalDates) {
                if (!aFinalDates || aFinalDates.length === 0) {
                    sap.ui.core.BusyIndicator.hide();
                    return;
                }
                this._executeCreateScheduleForDates(oODataModel, oDialogData, fOtHours, aEmployees, aFinalDates);
            }.bind(this)).catch(function (oError) {
                sap.ui.core.BusyIndicator.hide();
                if (oError && oError.cancelled) return;
                MessageBox.error("Unable to check non-working dates or holidays.");
            }.bind(this));
        },

        _confirmNonWorkingDateStrategy: function (aDates) {
            return this._getNonWorkingDates(aDates).then(function (aNonWorkingDates) {
                if (aNonWorkingDates.length === 0) return aDates;

                sap.ui.core.BusyIndicator.hide();

                var sDateList = aNonWorkingDates.map(function (item) {
                    return "- " + item.DateText + ": " + item.Reason;
                }).join("\n");

                return new Promise(function (resolve, reject) {
                    MessageBox.confirm(
                        "The selected date range contains Sundays or holidays:\n\n" + sDateList + "\n\n" +
                        "Do you want to create schedules for these dates?",
                        {
                            title: "Confirm Non-working Date Schedule",
                            actions: ["Create Including Days Off", "Skip Days Off", MessageBox.Action.CANCEL],
                            emphasizedAction: "Create Including Days Off",
                            onClose: function (sAction) {
                                if (sAction === MessageBox.Action.CANCEL) {
                                    reject({ cancelled: true });
                                    return;
                                }

                                if (sAction === "Create Including Days Off") {
                                    sap.ui.core.BusyIndicator.show(0);
                                    resolve(aDates);
                                    return;
                                }

                                var mSkipDates = {};
                                aNonWorkingDates.forEach(function (item) { mSkipDates[item.DateKey] = true; });
                                var aFinalDates = aDates.filter(function (dDate) {
                                    return !mSkipDates[this._dateKey(dDate)];
                                }.bind(this));

                                if (aFinalDates.length === 0) {
                                    MessageBox.error("All selected dates are Sundays or holidays. There are no regular working days to schedule.");
                                    reject({ cancelled: true });
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
                            return Promise.reject({ message: this._getPastDateMessage(dWorkDate) });
                        }
                        return this._createEmpShiftIfNotExists(oODataModel, oEmployee.Pernr, dWorkDate, oDialogData.ShiftId);
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
                this._loadCalendarData();
            }.bind(this)).catch(function (oError) {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.error(this._getODataErrorMessage(oError, "An error occurred while saving the work schedule or OT data."));
            }.bind(this));
        },

        _saveEditSchedule: function (oODataModel, oDialogData, fOtHours) {
            var dWorkDate = this._normalizeDate(oDialogData.PlanDate);
            var dODataWorkDate = this._toODataDate(dWorkDate);
            var pSaveShift = Promise.resolve();

            if (oDialogData.OldShiftId && oDialogData.OldShiftId !== oDialogData.ShiftId) {
                var sOldPath = this._buildEmpShiftPath(oODataModel, oDialogData.Pernr, dWorkDate, oDialogData.OldShiftId);
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
                return this._removeOtPlanByKey(oODataModel, oDialogData.Pernr, dWorkDate);
            }.bind(this)).then(function () {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.success("Work schedule has been updated successfully.");
                this.onCloseAddDialog();
                this._loadCalendarData();
            }.bind(this)).catch(function (oError) {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.error(this._getODataErrorMessage(oError, "An error occurred while updating the work schedule."));
            }.bind(this));
        },

        _deleteSchedule: function (oData) {
            var oODataModel = this.getView().getModel();
            sap.ui.core.BusyIndicator.show(0);
            var pDeleteShift = Promise.resolve();

            if (oData.Pernr && oData.WorkDate && oData.ShiftId) {
                pDeleteShift = this._deletePath(
                    oODataModel,
                    this._buildEmpShiftPath(oODataModel, oData.Pernr, oData.WorkDate, oData.ShiftId),
                    false
                );
            }

            pDeleteShift.then(function () {
                return this._readEmpShiftByDate(oODataModel, oData.Pernr, oData.WorkDate);
            }.bind(this)).then(function (aRemaining) {
                if (aRemaining.length === 0) {
                    return this._removeOtPlanByKey(oODataModel, oData.Pernr, oData.WorkDate || oData.PlanDate);
                }
                return Promise.resolve();
            }.bind(this)).then(function () {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.success("Work schedule has been deleted successfully.");
                this._loadCalendarData();
            }.bind(this)).catch(function (oError) {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.error(this._getODataErrorMessage(oError, "An error occurred while deleting the work schedule."));
            }.bind(this));
        },

        // =========================================================
        // ODATA HELPERS & UTILS
        // =========================================================
        _readSet: function (sPath, mParameters) {
            var oODataModel = this.getView().getModel();
            return new Promise(function (resolve, reject) {
                oODataModel.read(sPath, Object.assign({
                    success: function (oData) { resolve(oData.results || []); },
                    error: function (oError) { reject(oError); }
                }, mParameters || {}));
            });
        },

        _createEmpShiftIfNotExists: function (oODataModel, sPernr, dWorkDate, sShiftId) {
            return this._readEmpShiftByDate(oODataModel, sPernr, dWorkDate).then(function (aExisting) {
                if (aExisting.length > 0) {
                    return Promise.reject({
                        message: "Employee " + sPernr + " already has shift " + (aExisting[0].ShiftId || "") + " on " + this._normalizeDate(dWorkDate).toLocaleDateString("en-GB") + ". Please edit the existing schedule instead."
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
            return this._readSet("/EmpShift", {
                filters: [
                    new Filter("Pernr", FilterOperator.EQ, sPernr),
                    new Filter("WorkDate", FilterOperator.EQ, this._toODataDate(dWorkDate))
                ]
            });
        },

        _createEmpShift: function (oODataModel, oPayload) {
            return new Promise(function (resolve, reject) {
                oODataModel.create("/EmpShift", oPayload, {
                    success: function () { resolve(); },
                    error: function (oError) { reject(oError); }
                });
            });
        },

        _readOtPlanByDate: function (oODataModel, sPernr, dPlanDate) {
            return this._readSet("/OtPlan", {
                filters: [
                    new Filter("Pernr", FilterOperator.EQ, sPernr),
                    new Filter("PlanDate", FilterOperator.EQ, this._toODataDate(dPlanDate))
                ]
            });
        },

        _upsertOtPlan: function (oODataModel, oPayload) {
            return this._readOtPlanByDate(oODataModel, oPayload.Pernr, oPayload.PlanDate).then(function (aOtPlan) {
                if (aOtPlan && aOtPlan.length > 0) {
                    var sUpdatePath = oODataModel.createKey("/OtPlan", {
                        Pernr: aOtPlan[0].Pernr || oPayload.Pernr,
                        PlanDate: this._toODataDate(this._toDate(aOtPlan[0].PlanDate || oPayload.PlanDate))
                    });
                    return new Promise(function (resolve, reject) {
                        oODataModel.update(sUpdatePath, {
                            ShiftId: oPayload.ShiftId,
                            OtHours: oPayload.OtHours,
                            IsOt: oPayload.IsOt
                        }, {
                            success: resolve, error: reject
                        });
                    });
                }
                return new Promise(function (resolve, reject) {
                    oODataModel.create("/OtPlan", {
                        Pernr: oPayload.Pernr,
                        PlanDate: this._toODataDate(oPayload.PlanDate),
                        ShiftId: oPayload.ShiftId,
                        OtHours: oPayload.OtHours,
                        IsOt: oPayload.IsOt
                    }, { success: resolve, error: reject });
                }.bind(this));
            }.bind(this));
        },

        _removeOtPlanByKey: function (oODataModel, sPernr, dPlanDate) {
            return this._readOtPlanByDate(oODataModel, sPernr, dPlanDate).then(function (aOtPlan) {
                if (!aOtPlan || aOtPlan.length === 0) return Promise.resolve();
                var sPath = oODataModel.createKey("/OtPlan", {
                    Pernr: aOtPlan[0].Pernr || sPernr,
                    PlanDate: this._toODataDate(this._toDate(aOtPlan[0].PlanDate || dPlanDate))
                });
                return this._deletePath(oODataModel, sPath, true);
            }.bind(this));
        },

        _deletePath: function (oODataModel, sPath, bIgnoreNotFound) {
            return new Promise(function (resolve, reject) {
                if (!sPath) { resolve(); return; }
                oODataModel.remove(sPath, {
                    success: resolve,
                    error: function (oError) {
                        if (bIgnoreNotFound && Number(oError && oError.statusCode) === 404) resolve();
                        else reject(oError);
                    }
                });
            });
        },

        _normalizePernrForCompare: function (vPernr) {
            var sPernr = String(vPernr || "").trim();
            return sPernr ? sPernr.replace(/^0+/, "") || "0" : "";
        },

        _getNonWorkingDates: function (aDates) {
            return this._loadHolidayMap().then(function (mHolidayMap) {
                var aResult = [];
                aDates.forEach(function (dDate) {
                    var sDateKey = this._dateKey(dDate);
                    var aReasons = [];
                    if (this._isSunday(dDate)) aReasons.push("Sunday");
                    if (mHolidayMap[sDateKey]) aReasons.push("Holiday: " + mHolidayMap[sDateKey]);

                    if (aReasons.length > 0) {
                        aResult.push({
                            Date: dDate, DateKey: sDateKey,
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
                    mHolidayMap[this._dateKey(this._toDate(item.HolDate))] = item.HolDesc || "Holiday";
                }.bind(this));
                return mHolidayMap;
            }.bind(this)).catch(function () { return {}; });
        },

        _isSunday: function (vDate) {
            return this._normalizeDate(vDate).getDay() === 0;
        },

        _buildDateRange: function (dStart, dEnd) {
            var aDates = [], dCurrent = new Date(dStart);
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
            return "Date " + this._normalizeDate(vDate).toLocaleDateString("en-GB") + " has already passed. Creating, editing, or deleting work schedules for past dates is not allowed.";
        },

        _toODataDate: function (vDate) {
            var dDate = this._normalizeDate(vDate);
            return new Date(Date.UTC(dDate.getFullYear(), dDate.getMonth(), dDate.getDate(), 0, 0, 0));
        },

        _buildEmpShiftPath: function (oODataModel, sPernr, vWorkDate, sShiftId) {
            return oODataModel.createKey("/EmpShift", {
                Pernr: sPernr, WorkDate: this._toODataDate(vWorkDate), ShiftId: sShiftId
            });
        },

        _normalizeDate: function (vDate) {
            var dDate = new Date(vDate);
            dDate.setHours(0, 0, 0, 0);
            return dDate;
        },

        _toDate: function (vDate) {
            if (!vDate) return new Date();
            if (vDate instanceof Date) return vDate;
            if (typeof vDate === "string" && vDate.indexOf("/Date(") === 0) return new Date(parseInt(vDate.replace(/\D/g, ""), 10));
            return new Date(vDate);
        },

        _dateKey: function (vDate) {
            var dDate = this._normalizeDate(vDate);
            return dDate.getFullYear() + "-" + String(dDate.getMonth() + 1).padStart(2, "0") + "-" + String(dDate.getDate()).padStart(2, "0");
        },

        _getHoursMinutes: function (vTime) {
            if (!vTime) return { hours: 0, minutes: 0 };
            if (typeof vTime === "object" && vTime.ms !== undefined) {
                var iSec = Math.floor(vTime.ms / 1000);
                return { hours: Math.floor(iSec / 3600), minutes: Math.floor((iSec % 3600) / 60) };
            }
            var sTime = String(vTime);
            var aMatch = sTime.match(/^PT(\d+)H(\d+)M/);
            if (aMatch) return { hours: parseInt(aMatch[1], 10), minutes: parseInt(aMatch[2], 10) };
            if (/^\d{6}$/.test(sTime)) return { hours: parseInt(sTime.substring(0, 2), 10), minutes: parseInt(sTime.substring(2, 4), 10) };
            if (/^\d{2}:\d{2}:\d{2}$/.test(sTime)) return { hours: parseInt(sTime.substring(0, 2), 10), minutes: parseInt(sTime.substring(3, 5), 10) };
            return { hours: 0, minutes: 0 };
        },

        _formatTime: function (vTime) {
            var oTime = this._getHoursMinutes(vTime);
            return String(oTime.hours).padStart(2, "0") + ":" + String(oTime.minutes).padStart(2, "0");
        },

        formatAppointmentType: function (sShiftId, sOtHours) {
            if (parseFloat(sOtHours || "0") > 0) return sap.ui.unified.CalendarDayType.Type01;
            var sShift = String(sShiftId || "").toUpperCase();
            if (sShift === "CA_01") return sap.ui.unified.CalendarDayType.Type08;
            if (sShift === "CA_02") return sap.ui.unified.CalendarDayType.Type06;
            if (sShift === "CA_03") return sap.ui.unified.CalendarDayType.Type07;
            return sap.ui.unified.CalendarDayType.Type09;
        },

        _getODataErrorMessage: function (oError, sDefaultMessage) {
            var aMessages = [];
            var fnAddMessage = function (sMessage) {
                sMessage = String(sMessage || "").trim();
                if (sMessage && sMessage !== "HTTP request failed" && aMessages.indexOf(sMessage) === -1) aMessages.push(sMessage);
            };
            try {
                if (oError && oError.responseText) {
                    var oBody = JSON.parse(oError.responseText);
                    if (oBody && oBody.error && oBody.error.innererror && oBody.error.innererror.errordetails) {
                        oBody.error.innererror.errordetails.forEach(function (item) { fnAddMessage(item.message); });
                    }
                    if (oBody && oBody.error && oBody.error.message && oBody.error.message.value) {
                        fnAddMessage(oBody.error.message.value);
                    }
                }
            } catch (e) {
                if (oError && oError.responseText) fnAddMessage(oError.responseText);
            }
            if (oError && oError.message) fnAddMessage(oError.message);
            return aMessages.length > 0 ? aMessages.join("\n") : sDefaultMessage || "An unexpected error occurred.";
        }
    });
});