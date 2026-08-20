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
            if (oODataModel && oODataModel.setUseBatch) oODataModel.setUseBatch(false);

            this._initModels();
            this.getOwnerComponent().getRouter().getRoute("schedule").attachPatternMatched(this._onRouteMatched, this);
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

        _getI18nText: function (sKey, aArgs) {
            return this.getView().getModel("i18n").getResourceBundle().getText(sKey, aArgs);
        },

        // =========================================================
        // khởi tạo models
        // =========================================================
        _initModels: function () {
            this.getView().setModel(new JSONModel({ employees: [] }), "calendarModel");
            this.getView().setModel(new JSONModel({ shifts: [] }), "shiftLookupModel");
            this.getView().getModel("calendarModel").setSizeLimit(5000);
            this.getView().getModel("shiftLookupModel").setSizeLimit(1000);
            
            this.getView().setModel(new JSONModel({ employeeQuery: "", employeeFilter: "", deptQuery: "", deptFilter: "" }), "headerSearchModel");
            this.getView().setModel(new JSONModel(this._getDefaultDialogData()), "dialogModel");
        },

        _getDefaultDialogData: function () {
            return {
                AssignMode: "EMP", Pernr: "", EmployeeName: "", DeptId: "", DeptName: "",
                StartDate: new Date(), EndDate: new Date(), PlanDate: new Date(),
                ShiftId: "", OldShiftId: "", OtHours: "0.00", IsOt: false, isEdit: false,
                sEmpShiftPath: "", sOtPath: ""
            };
        },

        _installHideMonthsOption: function () {
            if (this._bHideMonthsOptionInstalled) return;
            this._bHideMonthsOptionInstalled = true;

            var fnHide = function () { this._hideMonthsOption(); }.bind(this);
            jQuery(document).on("click.hidePlanningCalendarMonths keydown.hidePlanningCalendarMonths", function () {
                setTimeout(fnHide, 50); setTimeout(fnHide, 150); setTimeout(fnHide, 300);
            });
            fnHide();
        },

        _hideMonthsOption: function () {
            jQuery(".sapMSelectListItemBase, .sapMSelectListItem").each(function () {
                var oItem = jQuery(this);
                if (oItem.text().trim() === "Months") { oItem.hide(); oItem.attr("aria-hidden", "true"); }
            });
        },

        // =========================================================
        // tải dữ liệu và build lịch làm việc (core logic)
        // =========================================================
        _loadCalendarData: function () {
            var oODataModel = this.getView().getModel();
            sap.ui.core.BusyIndicator.show(0);

            Promise.all([
                this._readSet("/EmpShift", { urlParameters: { "$top": 5000 } }),
                this._readSet("/OtPlan", { urlParameters: { "$top": 5000 } }).catch(function () { return []; }),
                this._readSet("/Employee", { urlParameters: { "$top": 5000 } }).catch(function () { return []; })
            ]).then(function (aRes) {
                var aCalendarEmp = this._buildCalendarEmployees(aRes[0] || [], aRes[1] || [], oODataModel, this._buildEmployeeMap(aRes[2] || []));
                this.getView().getModel("calendarModel").setProperty("/employees", aCalendarEmp);

                sap.ui.core.BusyIndicator.hide();
                setTimeout(function () { this._hideMonthsOption(); this._applyHeaderFilters(); }.bind(this), 100);
            }.bind(this)).catch(function (oErr) {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.error(this._getODataErrorMessage(oErr, this._getI18nText("msgLoadScheduleError")), { title: this._getI18nText("titleLoadScheduleError") });
            }.bind(this));
        },

        _buildEmployeeMap: function (aEmployees) {
            var mMap = {};
            (aEmployees || []).forEach(function (e) {
                var sKey = this._normalizePernrForCompare(e.Pernr);
                if (sKey) mMap[sKey] = e;
            }.bind(this));
            return mMap;
        },

        _buildCalendarEmployees: function (aEmpShift, aOtPlan, oODataModel, mEmpMap) {
            var mOtByKey = {}, oGrouped = {};

            aOtPlan.forEach(function (ot) {
                var sKey = this._normalizePernrForCompare(ot.Pernr);
                if (sKey) mOtByKey[sKey + "|" + this._dateKey(this._toDate(ot.PlanDate))] = ot;
            }.bind(this));

            aEmpShift.forEach(function (item) {
                var sPernrKey = this._normalizePernrForCompare(item.Pernr);
                if (mEmpMap && !mEmpMap[sPernrKey]) return;

                var oEmp = mEmpMap ? mEmpMap[sPernrKey] : null;
                var sPernr = oEmp?.Pernr || item.Pernr;
                var sEname = oEmp?.Ename || item.EmployeeName || this._getI18nText("txtUnknownEmployee");
                var sDeptId = oEmp?.DeptId || item.DeptId || "";
                var sDeptName = oEmp?.DeptName || item.DeptName || "";

                var dDate = this._toDate(item.WorkDate);
                var oOt = mOtByKey[sPernrKey + "|" + this._dateKey(dDate)];

                var dStart = new Date(dDate), dEnd = new Date(dDate);
                dStart.setHours(0, 30, 0, 0); dEnd.setHours(22, 30, 0, 0);

                var sTimeText = this._formatTime(item.ShiftTimeIn) + " - " + this._formatTime(item.ShiftTimeOut);
                var sOtHrs = oOt ? String(oOt.OtHours || "0.00") : "0.00";

                if (!oGrouped[sPernrKey]) oGrouped[sPernrKey] = { Pernr: sPernr, RealPernr: item.Pernr, EmployeeName: sEname, DeptId: sDeptId, DeptName: sDeptName, appointments: [] };

                oGrouped[sPernrKey].appointments.push({
                    Pernr: item.Pernr, DisplayPernr: sPernr, EmployeeName: sEname, DeptId: sDeptId, DeptName: sDeptName,
                    PlanDate: dDate, WorkDate: dDate, StartDate: dStart, EndDate: dEnd,
                    ShiftId: item.ShiftId, OldShiftId: item.ShiftId, ShiftTimeText: sTimeText, OtHours: sOtHrs, IsOt: oOt ? oOt.IsOt : false,
                    AppointmentTitle: this._getI18nText("txtShiftTitle", [item.ShiftId]),
                    AppointmentText: this._getI18nText("txtAppointmentText", [sTimeText, sOtHrs]),
                    AppointmentTooltip: this._getI18nText("txtAppointmentTooltip", [sEname, sPernr, (sDeptName || sDeptId || this._getI18nText("txtNA")), item.ShiftId, sTimeText, sOtHrs]),
                    sEmpShiftPath: this._buildEmpShiftPath(oODataModel, item.Pernr, dDate, item.ShiftId),
                    sOtPath: oOt ? oODataModel.createKey("/OtPlan", { Pernr: oOt.Pernr, PlanDate: this._toODataDate(this._toDate(oOt.PlanDate)) }) : ""
                });
            }.bind(this));

            return Object.values(oGrouped);
        },

        _loadShiftLookup: function () {
            var oODataModel = this.getView().getModel();
            if (!oODataModel) return;

            oODataModel.read("/ShiftLookup", {
                success: function (oData) {
                    var aShifts = (oData.results || []).map(function (item) {
                        return { ShiftId: item.ShiftId, TimeIn: item.TimeIn, TimeOut: item.TimeOut, ShiftText: item.ShiftId + " - " + this._formatTime(item.TimeIn) + " to " + this._formatTime(item.TimeOut) };
                    }.bind(this));
                    this.getView().getModel("shiftLookupModel").setProperty("/shifts", aShifts);
                    
                    var oDialogModel = this.getView().getModel("dialogModel");
                    if (!oDialogModel.getProperty("/ShiftId") && aShifts.length > 0) oDialogModel.setProperty("/ShiftId", aShifts[0].ShiftId);
                }.bind(this)
            });
        },

        // =========================================================
        // popup tìm kiếm & bộ lọc (header & dialog value help)
        // =========================================================
        _openPopover: function (sFragmentName) {
            var oView = this.getView();
            var sVar = sFragmentName.includes("Employee") ? "_pEmpValueHelpDialog" : "_pDeptValueHelpDialog";
            var sListId = sFragmentName.includes("Employee") ? "empValueHelpList" : "deptValueHelpList";

            if (!this[sVar]) {
                this[sVar] = Fragment.load({ id: oView.getId(), name: "com.app.zu26g13.app.view." + sFragmentName, controller: this })
                    .then(function (oPop) { oView.addDependent(oPop); return oPop; });
            }
            this[sVar].then(function (oPop) {
                var oList = this.byId(sListId);
                if (oList) { oList.getBinding("items").filter([]); oList.removeSelections(true); }
                oPop.openBy(this._oCurrentInput);
            }.bind(this));
        },

        onHeaderEmployeeValueHelpRequest: function (oEvt) { this._sValueHelpContext = "HEADER"; this._oCurrentInput = oEvt.getSource(); this._openPopover("EmployeeValueHelp"); },
        onPernrInputValueHelpRequest: function (oEvt) { this._sValueHelpContext = "DIALOG"; this._oCurrentInput = oEvt.getSource(); this._openPopover("EmployeeValueHelp"); },
        onHeaderDepartmentValueHelpRequest: function (oEvt) { this._sValueHelpContext = "HEADER"; this._oCurrentInput = oEvt.getSource(); this._openPopover("DepartmentValueHelp"); },
        onDeptInputValueHelpRequest: function (oEvt) { this._sValueHelpContext = "DIALOG"; this._oCurrentInput = oEvt.getSource(); this._openPopover("DepartmentValueHelp"); },

        onEmployeeValueHelpSearch: function (oEvt) {
            var sVal = oEvt.getParameter("value") || oEvt.getParameter("newValue");
            this.byId("empValueHelpList").getBinding("items").filter([new Filter({ filters: [new Filter("Ename", FilterOperator.Contains, sVal), new Filter("Pernr", FilterOperator.EQ, sVal)], and: false })]);
        },
        onDeptValueHelpSearch: function (oEvt) {
            var sVal = oEvt.getParameter("value") || oEvt.getParameter("newValue");
            this.byId("deptValueHelpList").getBinding("items").filter([new Filter({ filters: [new Filter("DeptName", FilterOperator.Contains, sVal), new Filter("DeptId", FilterOperator.Contains, sVal)], and: false })]);
        },

        onEmployeeValueHelpConfirm: function (oEvt) {
            var oItem = oEvt.getParameter("listItem");
            if (oItem && this._oCurrentInput) {
                this._oCurrentInput.setValue(oItem.getDescription());
                if (this._sValueHelpContext === "HEADER") {
                    this._setHeaderFilter("employee", oItem.getDescription());
                } else {
                    this.getView().getModel("dialogModel").setProperty("/Pernr", oItem.getDescription());
                    this.getView().getModel("dialogModel").setProperty("/EmployeeName", oItem.getTitle());
                }
                this._pEmpValueHelpDialog.then(function (oPop) { oPop.close(); });
            }
        },
        onEmployeeValueHelpCancel: function () { if (this._pEmpValueHelpDialog) this._pEmpValueHelpDialog.then(function (oPop) { oPop.close(); }); },

        onDeptValueHelpConfirm: function (oEvt) {
            var oItem = oEvt.getParameter("listItem");
            if (oItem && this._oCurrentInput) {
                this._oCurrentInput.setValue(oItem.getDescription());
                if (this._sValueHelpContext === "HEADER") {
                    this._setHeaderFilter("department", oItem.getDescription());
                } else {
                    this.getView().getModel("dialogModel").setProperty("/DeptId", oItem.getDescription());
                    this.getView().getModel("dialogModel").setProperty("/DeptName", oItem.getTitle());
                }
                this._pDeptValueHelpDialog.then(function (oPop) { oPop.close(); });
            }
        },
        onDeptValueHelpCancel: function () { if (this._pDeptValueHelpDialog) this._pDeptValueHelpDialog.then(function (oPop) { oPop.close(); }); },

        // live search header
        onHeaderEmployeeLiveChange: function (oEvt) { this._setHeaderFilter("employee", oEvt.getParameter("value") || oEvt.getParameter("newValue") || ""); },
        onHeaderEmployeeSubmit: function (oEvt) { this._setHeaderFilter("employee", oEvt.getParameter("value") || ""); },
        onHeaderDepartmentLiveChange: function (oEvt) { this._setHeaderFilter("department", oEvt.getParameter("value") || oEvt.getParameter("newValue") || ""); },
        onHeaderDepartmentSubmit: function (oEvt) { this._setHeaderFilter("department", oEvt.getParameter("value") || ""); },

        onClearHeaderFilters: function () {
            this.getView().getModel("headerSearchModel").setData({ employeeQuery: "", employeeFilter: "", deptQuery: "", deptFilter: "" });
            if (this.byId("HeaderEmployeeSearchInput")) this.byId("HeaderEmployeeSearchInput").setValue("");
            if (this.byId("HeaderDepartmentSearchInput")) this.byId("HeaderDepartmentSearchInput").setValue("");
            this._applyHeaderFilters();
        },

        _setHeaderFilter: function (sType, sValue) {
            var oModel = this.getView().getModel("headerSearchModel");
            oModel.setProperty(sType === "employee" ? "/employeeQuery" : "/deptQuery", sValue);
            oModel.setProperty(sType === "employee" ? "/employeeFilter" : "/deptFilter", sValue);
            this._applyHeaderFilters();
        },

        _applyHeaderFilters: function () {
            var oBinding = this.byId("idPlanningCalendar")?.getBinding("rows");
            if (!oBinding) return;

            var oMod = this.getView().getModel("headerSearchModel");
            var sEmp = String(oMod.getProperty("/employeeFilter") || oMod.getProperty("/employeeQuery") || "").trim();
            var sDept = String(oMod.getProperty("/deptFilter") || oMod.getProperty("/deptQuery") || "").trim();
            var aFilters = [];

            if (sEmp) aFilters.push(new Filter({ filters: [new Filter("EmployeeName", FilterOperator.Contains, sEmp), new Filter("Pernr", FilterOperator.EQ, sEmp)], and: false }));
            if (sDept) aFilters.push(new Filter({ filters: [new Filter("DeptId", FilterOperator.Contains, sDept), new Filter("DeptName", FilterOperator.Contains, sDept)], and: false }));

            oBinding.filter(aFilters);
        },

        // =========================================================
        // xử lý thêm/sửa lịch làm việc (crud)
        // =========================================================
        onAssignModeChange: function (oEvt) {
            var sKey = oEvt.getParameter("key") || oEvt.getParameter("item").getKey() || "EMP";
            var oModel = this.getView().getModel("dialogModel");
            oModel.setProperty("/AssignMode", sKey);
            if (sKey === "EMP") { oModel.setProperty("/DeptId", ""); oModel.setProperty("/DeptName", ""); }
            else { oModel.setProperty("/Pernr", ""); oModel.setProperty("/EmployeeName", ""); }
        },

        onOpenCreateDialog: function () {
            this.getView().getModel("dialogModel").setData(this._getDefaultDialogData());
            this._loadShiftLookup();
            if (!this.pDialog) {
                this.pDialog = Fragment.load({ id: this.getView().getId(), name: "com.app.zu26g13.app.view.AddOtDialog", controller: this })
                    .then(function (oDialog) { this.getView().addDependent(oDialog); return oDialog; }.bind(this));
            }
            this.pDialog.then(function (oDialog) { oDialog.open(); });
        },

        _openEditDialog: function (oData) {
            if (this._isPastDate(oData.PlanDate)) return MessageBox.error(this._getPastDateMessage(oData.PlanDate), { title: this._getI18nText("titleEditPastError") });

            this.getView().getModel("dialogModel").setData({
                AssignMode: "EMP", Pernr: oData.Pernr, EmployeeName: oData.EmployeeName || "", DeptId: oData.DeptId || "", DeptName: oData.DeptName || "",
                PlanDate: oData.PlanDate, StartDate: oData.PlanDate, EndDate: oData.PlanDate, ShiftId: oData.ShiftId, OldShiftId: oData.OldShiftId || oData.ShiftId,
                OtHours: oData.OtHours || "0.00", IsOt: parseFloat(oData.OtHours || "0") > 0, isEdit: true, sEmpShiftPath: oData.sEmpShiftPath, sOtPath: oData.sOtPath
            });

            this._loadShiftLookup();
            if (!this.pDialog) {
                this.pDialog = Fragment.load({ id: this.getView().getId(), name: "com.app.zu26g13.app.view.AddOtDialog", controller: this })
                    .then(function (oDialog) { this.getView().addDependent(oDialog); return oDialog; }.bind(this));
            }
            this.pDialog.then(function (oDialog) { oDialog.open(); });
        },

        onCloseAddDialog: function () { if (this.pDialog) this.pDialog.then(function (oDialog) { oDialog.close(); }); },

        onAppointmentSelect: function (oEvt) {
            var oApp = oEvt.getParameter("appointment");
            if (!oApp) return;

            var oData = oApp.getBindingContext("calendarModel").getObject();
            var bPastDate = this._isPastDate(oData.PlanDate);
            var sMsg = this._getI18nText("msgScheduleDetails", [(oData.DisplayPernr || oData.Pernr), (oData.EmployeeName || ""), (oData.DeptName || oData.DeptId || this._getI18nText("txtNA")), this._normalizeDate(oData.PlanDate).toLocaleDateString("en-GB"), oData.ShiftId, (oData.ShiftTimeText || ""), oData.OtHours]);
            if (bPastDate) sMsg += "\n\n" + this._getI18nText("msgPastDateNote");

            var aActs = bPastDate ? [this._getI18nText("btnActionClose")] : [this._getI18nText("btnActionClose"), this._getI18nText("btnActionEdit"), this._getI18nText("btnActionDelete")];

            MessageBox.show(sMsg, {
                icon: MessageBox.Icon.INFORMATION, title: this._getI18nText("titleScheduleDetails"), actions: aActs, emphasizedAction: this._getI18nText("btnActionClose"),
                onClose: function (sAction) {
                    if (bPastDate) return;
                    if (sAction === this._getI18nText("btnActionDelete")) this._deleteSchedule(oData);
                    else if (sAction === this._getI18nText("btnActionEdit")) this._openEditDialog(oData);
                }.bind(this)
            });
        },

        onSaveOtPlan: function () {
            var oODataModel = this.getView().getModel();
            var oDialogModel = this.getView().getModel("dialogModel");
            var oDialogData = oDialogModel.getData();
            var fOtHours = parseFloat(oDialogData.OtHours || "0");

            if (isNaN(fOtHours) || fOtHours < 0) return MessageBox.error(this._getI18nText("msgInvalidOt"), { title: this._getI18nText("titleInvalidOt") });
            if (!oDialogData.ShiftId) return MessageBox.error(this._getI18nText("msgMissingShift"), { title: this._getI18nText("titleMissingShift") });

            sap.ui.core.BusyIndicator.show(0);

            if (oDialogData.isEdit) return this._handleEditSave(oODataModel, oDialogData, fOtHours);
            if (oDialogData.AssignMode === "DEPT") return this._handleDepartmentCreate(oODataModel, oDialogData, fOtHours);
            this._handleEmployeeCreate(oODataModel, oDialogModel, oDialogData, fOtHours);
        },

        _handleEditSave: function (oODataModel, oDialogData, fOtHours) {
            sap.ui.core.BusyIndicator.hide();
            if (!oDialogData.Pernr) return MessageBox.error(this._getI18nText("msgMissingEmpUpdate"), { title: this._getI18nText("titleMissingEmp") });
            if (this._isPastDate(oDialogData.PlanDate)) return MessageBox.error(this._getPastDateMessage(oDialogData.PlanDate), { title: this._getI18nText("titleUpdatePastError") });
            if (this._isShiftAlreadyStarted(oDialogData.PlanDate, oDialogData.ShiftId)) return MessageBox.error(this._getI18nText("msgShiftAlreadyStarted", [oDialogData.ShiftId]), { title: this._getI18nText("titleShiftStartedError") });

            sap.ui.core.BusyIndicator.show(0);
            this._saveEditSchedule(oODataModel, oDialogData, fOtHours);
        },

        _handleDepartmentCreate: function (oODataModel, oDialogData, fOtHours) {
            if (!oDialogData.DeptId) { sap.ui.core.BusyIndicator.hide(); return MessageBox.error(this._getI18nText("msgMissingDept"), { title: this._getI18nText("titleMissingDept") }); }

            this._getEmployeesByDepartment(oDialogData.DeptId).then(function (aEmp) {
                if (aEmp.length === 0) { sap.ui.core.BusyIndicator.hide(); return MessageBox.error(this._getI18nText("msgDeptNoEmp"), { title: this._getI18nText("titleNoEmpFound") }); }
                this._saveCreateScheduleForEmployees(oODataModel, oDialogData, fOtHours, aEmp);
            }.bind(this)).catch(function (e) { sap.ui.core.BusyIndicator.hide(); MessageBox.error(this._getODataErrorMessage(e, this._getI18nText("msgLoadDeptEmpError"))); }.bind(this));
        },

        _handleEmployeeCreate: function (oODataModel, oDialogModel, oDialogData, fOtHours) {
            if (!oDialogData.Pernr) { sap.ui.core.BusyIndicator.hide(); return MessageBox.error(this._getI18nText("msgSelectEmp"), { title: this._getI18nText("titleMissingEmp") }); }

            this._ensureEmployeeExists(oDialogData.Pernr).then(function (oEmp) {
                oDialogData.Pernr = oEmp.Pernr; oDialogModel.setProperty("/Pernr", oEmp.Pernr);
                oDialogModel.setProperty("/EmployeeName", oEmp.Ename || ""); oDialogModel.setProperty("/DeptId", oEmp.DeptId || "");
                this._saveCreateScheduleForEmployees(oODataModel, oDialogData, fOtHours, [oEmp]);
            }.bind(this)).catch(function (e) { sap.ui.core.BusyIndicator.hide(); MessageBox.error(e?.message || this._getI18nText("msgEmpNotExistValueHelp"), { title: this._getI18nText("titleInvalidEmp") }); }.bind(this));
        },

        // =========================================================
        // logic luồng odata (promise chain)
        // =========================================================
        _saveCreateScheduleForEmployees: function (oODataModel, oDialogData, fOtHours, aEmployees) {
            var dStart = this._normalizeDate(oDialogData.StartDate);
            var dEnd = this._normalizeDate(oDialogData.EndDate);

            if (dStart > dEnd) { sap.ui.core.BusyIndicator.hide(); return MessageBox.error(this._getI18nText("msgInvalidDateRange"), { title: this._getI18nText("titleInvalidDateRange") }); }
            if (this._isPastDate(dStart)) { sap.ui.core.BusyIndicator.hide(); return MessageBox.error(this._getI18nText("msgContainsPastDates", [dStart.toLocaleDateString("en-GB")]), { title: this._getI18nText("titleCreateScheduleError") }); }

            this._confirmNonWorkingDateStrategy(this._buildDateRange(dStart, dEnd)).then(function (aFinalDates) {
                if (!aFinalDates || aFinalDates.length === 0) { sap.ui.core.BusyIndicator.hide(); return; }
                this._executeCreateScheduleForDates(oODataModel, oDialogData, fOtHours, aEmployees, aFinalDates);
            }.bind(this)).catch(function (e) { sap.ui.core.BusyIndicator.hide(); if (!e?.cancelled) MessageBox.error(this._getI18nText("msgCheckNonWorkingError")); }.bind(this));
        },

        _confirmNonWorkingDateStrategy: function (aDates) {
            return this._getNonWorkingDates(aDates).then(function (aNonWorkingDates) {
                if (aNonWorkingDates.length === 0) return aDates;
                sap.ui.core.BusyIndicator.hide();
                
                var sDateList = aNonWorkingDates.map(function (item) { return "- " + item.DateText + ": " + item.Reason; }).join("\n");
                return new Promise(function (resolve, reject) {
                    MessageBox.confirm(this._getI18nText("msgConfirmNonWorking", [sDateList]), {
                        title: this._getI18nText("titleConfirmNonWorking"),
                        actions: [this._getI18nText("btnCreateIncludeOff"), this._getI18nText("btnSkipOff"), MessageBox.Action.CANCEL],
                        emphasizedAction: this._getI18nText("btnCreateIncludeOff"),
                        onClose: function (sAction) {
                            if (sAction === MessageBox.Action.CANCEL) return reject({ cancelled: true });
                            if (sAction === this._getI18nText("btnCreateIncludeOff")) { sap.ui.core.BusyIndicator.show(0); return resolve(aDates); }
                            
                            var mSkipDates = {}; aNonWorkingDates.forEach(function (i) { mSkipDates[i.DateKey] = true; });
                            var aFinalDates = aDates.filter(function (d) { return !mSkipDates[this._dateKey(d)]; }.bind(this));
                            
                            if (aFinalDates.length === 0) { MessageBox.error(this._getI18nText("msgAllNonWorking")); return reject({ cancelled: true }); }
                            sap.ui.core.BusyIndicator.show(0); resolve(aFinalDates);
                        }.bind(this)
                    });
                }.bind(this));
            }.bind(this));
        },

        _executeCreateScheduleForDates: function (oODataModel, oDialogData, fOtHours, aEmployees, aDates) {
            var pChain = Promise.resolve();

            aEmployees.forEach(function (oEmployee) {
                aDates.forEach(function (dWorkDate) {
                    pChain = pChain.then(function () {
                        if (this._isPastDate(dWorkDate)) return Promise.reject({ message: this._getPastDateMessage(dWorkDate) });
                        if (this._isShiftAlreadyStarted(dWorkDate, oDialogData.ShiftId)) return Promise.reject({ message: this._getI18nText("msgShiftAlreadyStarted", [oDialogData.ShiftId]) });
                        return this._createEmpShiftIfNotExists(oODataModel, oEmployee.Pernr, dWorkDate, oDialogData.ShiftId);
                    }.bind(this)).then(function () {
                        if (fOtHours > 0) {
                            return this._upsertOtPlan(oODataModel, { Pernr: oEmployee.Pernr, PlanDate: this._toODataDate(dWorkDate), ShiftId: oDialogData.ShiftId, OtHours: fOtHours.toFixed(2), IsOt: true })
                                .catch(function (e) {
                                    return this._deletePath(oODataModel, this._buildEmpShiftPath(oODataModel, oEmployee.Pernr, dWorkDate, oDialogData.ShiftId), true).then(function () { return Promise.reject(e); });
                                }.bind(this));
                        }
                    }.bind(this));
                }.bind(this));
            }.bind(this));

            pChain.then(function () {
                sap.ui.core.BusyIndicator.hide(); MessageToast.show(this._getI18nText("msgScheduleCreated"));
                this.onCloseAddDialog(); oODataModel.refresh(true, true); this._loadCalendarData();
            }.bind(this)).catch(function (e) { sap.ui.core.BusyIndicator.hide(); MessageBox.error(this._getODataErrorMessage(e, this._getI18nText("msgCreateScheduleError"))); }.bind(this));
        },

        _saveEditSchedule: function (oODataModel, oDialogData, fOtHours) {
            var dWorkDate = this._normalizeDate(oDialogData.PlanDate);
            var pSaveShift = Promise.resolve();

            if (oDialogData.OldShiftId && oDialogData.OldShiftId !== oDialogData.ShiftId) {
                pSaveShift = this._deletePath(oODataModel, this._buildEmpShiftPath(oODataModel, oDialogData.Pernr, dWorkDate, oDialogData.OldShiftId), true).then(function () {
                    return this._createEmpShift(oODataModel, { Pernr: oDialogData.Pernr, WorkDate: this._toODataDate(dWorkDate), ShiftId: oDialogData.ShiftId });
                }.bind(this));
            }

            pSaveShift.then(function () {
                if (fOtHours > 0) return this._upsertOtPlan(oODataModel, { Pernr: oDialogData.Pernr, PlanDate: this._toODataDate(dWorkDate), ShiftId: oDialogData.ShiftId, OtHours: fOtHours.toFixed(2), IsOt: true });
                return this._removeOtPlanByKey(oODataModel, oDialogData.Pernr, dWorkDate);
            }.bind(this)).then(function () {
                sap.ui.core.BusyIndicator.hide(); MessageToast.show(this._getI18nText("msgScheduleUpdated"));
                this.onCloseAddDialog(); this._loadCalendarData();
            }.bind(this)).catch(function (e) { sap.ui.core.BusyIndicator.hide(); MessageBox.error(this._getODataErrorMessage(e, this._getI18nText("msgUpdateScheduleError"))); }.bind(this));
        },

        _deleteSchedule: function (oData) {
            var oODataModel = this.getView().getModel();
            sap.ui.core.BusyIndicator.show(0);

            var pDeleteShift = oData.Pernr && oData.WorkDate && oData.ShiftId ? this._deletePath(oODataModel, this._buildEmpShiftPath(oODataModel, oData.Pernr, oData.WorkDate, oData.ShiftId), false) : Promise.resolve();

            pDeleteShift.then(function () { return this._readEmpShiftByDate(oODataModel, oData.Pernr, oData.WorkDate); }.bind(this))
            .then(function (aRem) { if (aRem.length === 0) return this._removeOtPlanByKey(oODataModel, oData.Pernr, oData.WorkDate || oData.PlanDate); }.bind(this))
            .then(function () { sap.ui.core.BusyIndicator.hide(); MessageToast.show(this._getI18nText("msgScheduleDeleted")); this._loadCalendarData(); }.bind(this))
            .catch(function (e) { sap.ui.core.BusyIndicator.hide(); MessageBox.error(this._getODataErrorMessage(e, this._getI18nText("msgDeleteScheduleError"))); }.bind(this));
        },

        // =========================================================
        // gọi api & wrapper helper
        // =========================================================
        _readSet: function (sPath, mParams) {
            var oModel = this.getView().getModel();
            return new Promise(function (res, rej) { oModel.read(sPath, Object.assign({ success: function (d) { res(d.results || []); }, error: rej }, mParams || {})); });
        },

        _createEmpShiftIfNotExists: function (oModel, sPernr, dDate, sShiftId) {
            return this._readEmpShiftByDate(oModel, sPernr, dDate).then(function (aExist) {
                if (aExist.length > 0) return Promise.reject({ message: this._getI18nText("msgShiftAlreadyExists", [sPernr, (aExist[0].ShiftId || ""), this._normalizeDate(dDate).toLocaleDateString("en-GB")]) });
                return this._createEmpShift(oModel, { Pernr: sPernr, WorkDate: this._toODataDate(dDate), ShiftId: sShiftId });
            }.bind(this));
        },

        _readEmpShiftByDate: function (oModel, sPernr, dDate) {
            return this._readSet("/EmpShift", { filters: [new Filter("Pernr", FilterOperator.EQ, sPernr), new Filter("WorkDate", FilterOperator.EQ, this._toODataDate(dDate))] });
        },

        _createEmpShift: function (oModel, oPayload) {
            return new Promise(function (res, rej) { oModel.create("/EmpShift", oPayload, { success: res, error: rej }); });
        },

        _readOtPlanByDate: function (oModel, sPernr, dDate) {
            return this._readSet("/OtPlan", { filters: [new Filter("Pernr", FilterOperator.EQ, sPernr), new Filter("PlanDate", FilterOperator.EQ, this._toODataDate(dDate))] });
        },

        _upsertOtPlan: function (oModel, oPayload) {
            return this._readOtPlanByDate(oModel, oPayload.Pernr, oPayload.PlanDate).then(function (aPlan) {
                if (aPlan && aPlan.length > 0) {
                    var sPath = oModel.createKey("/OtPlan", { Pernr: aPlan[0].Pernr || oPayload.Pernr, PlanDate: this._toODataDate(this._toDate(aPlan[0].PlanDate || oPayload.PlanDate)) });
                    return new Promise(function (res, rej) { oModel.update(sPath, { ShiftId: oPayload.ShiftId, OtHours: oPayload.OtHours, IsOt: oPayload.IsOt }, { success: res, error: rej }); });
                }
                return new Promise(function (res, rej) { oModel.create("/OtPlan", oPayload, { success: res, error: rej }); });
            }.bind(this));
        },

        _removeOtPlanByKey: function (oModel, sPernr, dDate) {
            return this._readOtPlanByDate(oModel, sPernr, dDate).then(function (aPlan) {
                if (!aPlan || aPlan.length === 0) return Promise.resolve();
                var sPath = oModel.createKey("/OtPlan", { Pernr: aPlan[0].Pernr || sPernr, PlanDate: this._toODataDate(this._toDate(aPlan[0].PlanDate || dDate)) });
                return this._deletePath(oModel, sPath, true);
            }.bind(this));
        },

        _deletePath: function (oModel, sPath, bIgnoreNotFound) {
            return new Promise(function (res, rej) {
                if (!sPath) return res();
                oModel.remove(sPath, { success: res, error: function (e) { if (bIgnoreNotFound && Number(e?.statusCode) === 404) res(); else rej(e); } });
            });
        },

        _ensureEmployeeExists: function (sPernr) {
            return this._readSet("/Employee", { filters: [new Filter("Pernr", FilterOperator.EQ, sPernr)] }).then(function (aRes) {
                if (aRes && aRes.length > 0) return aRes[0];
                return Promise.reject({ message: this._getI18nText("msgEmpNotExist", [sPernr]) });
            }.bind(this));
        },
        _getEmployeesByDepartment: function (sDeptId) { return this._readSet("/Employee", { filters: [new Filter("DeptId", FilterOperator.EQ, sDeptId)] }); },

        // =========================================================
        // tiện ích ngày giờ (date time utils)
        // =========================================================
        _normalizePernrForCompare: function (v) { return String(v || "").trim().replace(/^0+/, "") || "0"; },
        _getTodayDateOnly: function () { var d = new Date(); d.setHours(0, 0, 0, 0); return d; },
        _isPastDate: function (vDate) { return this._normalizeDate(vDate) < this._getTodayDateOnly(); },
        _getPastDateMessage: function (vDate) { return this._getI18nText("msgDatePassed", [this._normalizeDate(vDate).toLocaleDateString("en-GB")]); },
        _toODataDate: function (vDate) { var d = this._normalizeDate(vDate); return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0)); },
        _buildEmpShiftPath: function (oM, sP, vD, sS) { return oM.createKey("/EmpShift", { Pernr: sP, WorkDate: this._toODataDate(vD), ShiftId: sS }); },
        _normalizeDate: function (vDate) { var d = new Date(vDate); d.setHours(0, 0, 0, 0); return d; },
        _toDate: function (vDate) { if (!vDate) return new Date(); if (vDate instanceof Date) return vDate; if (typeof vDate === "string" && vDate.indexOf("/Date(") === 0) return new Date(parseInt(vDate.replace(/\D/g, ""), 10)); return new Date(vDate); },
        _dateKey: function (vDate) { var d = this._normalizeDate(vDate); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); },

        _getNonWorkingDates: function (aDates) {
            return this._loadHolidayMap().then(function (mHol) {
                var aRes = [];
                aDates.forEach(function (d) {
                    var aReasons = [];
                    if (this._normalizeDate(d).getDay() === 0) aReasons.push(this._getI18nText("txtSunday"));
                    if (mHol[this._dateKey(d)]) aReasons.push(this._getI18nText("txtHolidayPrefix", [mHol[this._dateKey(d)]]));
                    if (aReasons.length > 0) aRes.push({ Date: d, DateKey: this._dateKey(d), DateText: d.toLocaleDateString("en-GB"), Reason: aReasons.join(", ") });
                }.bind(this));
                return aRes;
            }.bind(this));
        },
        _loadHolidayMap: function () {
            return this._readSet("/Holiday").then(function (aHol) { var m = {}; aHol.forEach(function (i) { m[this._dateKey(this._toDate(i.HolDate))] = i.HolDesc || this._getI18nText("txtHoliday"); }.bind(this)); return m; }.bind(this)).catch(function () { return {}; });
        },
        _buildDateRange: function (dStart, dEnd) {
            var a = [], d = new Date(dStart);
            while (d <= dEnd) { a.push(this._normalizeDate(d)); d.setDate(d.getDate() + 1); }
            return a;
        },

        _formatTime: function (vTime) {
            var h = 0, m = 0;
            if (vTime && vTime.ms !== undefined) { var s = Math.floor(vTime.ms / 1000); h = Math.floor(s / 3600); m = Math.floor((s % 3600) / 60); }
            else { var t = String(vTime || ""), a = t.match(/^PT(\d+)H(\d+)M/); if (a) { h = parseInt(a[1], 10); m = parseInt(a[2], 10); } else if (/^\d{6}$/.test(t)) { h = parseInt(t.substring(0, 2), 10); m = parseInt(t.substring(2, 4), 10); } else if (/^\d{2}:\d{2}:\d{2}$/.test(t)) { h = parseInt(t.substring(0, 2), 10); m = parseInt(t.substring(3, 5), 10); } }
            return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
        },

        formatAppointmentType: function (sShiftId, sOtHours) {
            if (parseFloat(sOtHours || "0") > 0) return sap.ui.unified.CalendarDayType.Type01;
            var s = String(sShiftId || "").toUpperCase();
            return s === "CA_01" ? sap.ui.unified.CalendarDayType.Type08 : (s === "CA_02" ? sap.ui.unified.CalendarDayType.Type06 : (s === "CA_03" ? sap.ui.unified.CalendarDayType.Type07 : sap.ui.unified.CalendarDayType.Type09));
        },

        _isShiftAlreadyStarted: function (vDate, sShiftId) {
            if (this._normalizeDate(vDate).getTime() !== this._getTodayDateOnly().getTime()) return false;
            var oShift = (this.getView().getModel("shiftLookupModel").getProperty("/shifts") || []).find(function (s) { return s.ShiftId === sShiftId; });
            if (oShift && oShift.TimeIn) {
                var dStart = new Date(), t = String(oShift.TimeIn).match(/^PT(\d+)H(\d+)M/) || [];
                dStart.setHours(t[1] || parseInt(String(oShift.TimeIn).substring(0, 2)), t[2] || parseInt(String(oShift.TimeIn).substring(2, 4)), 0, 0);
                return new Date() > dStart;
            }
            return false;
        },

        _getODataErrorMessage: function (oErr, sDef) {
            try { var o = JSON.parse(oErr.responseText); if (o?.error?.message?.value) return o.error.message.value; } catch (e) {}
            return oErr?.message || sDef || this._getI18nText("msgUnexpectedError");
        }
    });
});