sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment"
], function (Controller, JSONModel, MessageBox, MessageToast, Fragment) {
    "use strict";

    return Controller.extend("com.app.zu26g13.app.controller.ShiftConfig", {

        onInit: function () {
            var oODataModel = this.getOwnerComponent().getModel();

            if (oODataModel && oODataModel.setUseBatch) {
                oODataModel.setUseBatch(false);
            }

            this.getView().setModel(
                new JSONModel(this._getDefaultShiftData()),
                "shiftModel"
            );

            this._attachAutoReloadHandlers();
        },

        // =========================================================
        // HELPER FUNCTIONS
        // =========================================================

        _getI18nText: function (sKey, aArgs) {
            return this.getView().getModel("i18n").getResourceBundle().getText(sKey, aArgs);
        },

        _getDefaultShiftData: function () {
            return {
                ShiftId: "",
                StdHours: "8",
                TimeIn: "070000",
                TimeOut: "150000",
                NextDay: "",
                NextDayBool: false,
                GraceMins: "0",
                isEdit: false,
                sPath: ""
            };
        },

        _attachAutoReloadHandlers: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            var oRoute = oRouter && oRouter.getRoute("shiftConfig");

            if (oRoute && !this._bRouteAttached) {
                oRoute.attachPatternMatched(this._reloadViewData, this);
                this._bRouteAttached = true;
            }
        },

        _publishDataChanged: function (sAction) {
            sap.ui.getCore().getEventBus().publish("codesap", "DataChanged", {
                source: "Shift",
                action: sAction || "refresh",
                timestamp: Date.now()
            });
        },

        // =========================================================
        // DIALOG OPERATIONS
        // =========================================================

        onOpenAddDialog: function () {
            var oShiftModel = this.getView().getModel("shiftModel");
            oShiftModel.setData(this._getDefaultShiftData());
            this._openDialog();
        },

        onEditShift: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();

            if (!oContext) {
                MessageBox.error(this._getI18nText("msgErrorGetShiftData"));
                return;
            }

            var oData = oContext.getObject();
            var oODataModel = this.getView().getModel();

            this.getView().getModel("shiftModel").setData({
                ShiftId: oData.ShiftId || "",
                StdHours: oData.StdHours !== undefined && oData.StdHours !== null ? String(oData.StdHours) : "8",
                TimeIn: this._edmTimeToHHmmss(oData.TimeIn),
                TimeOut: this._edmTimeToHHmmss(oData.TimeOut),
                NextDay: oData.NextDay,
                NextDayBool: this._isNextDayTrue(oData.NextDay),
                GraceMins: oData.GraceMins !== undefined && oData.GraceMins !== null ? String(oData.GraceMins) : "0",
                isEdit: true,
                sPath: this._buildSchedulePath(oODataModel, oData.ShiftId)
            });

            this._openDialog();
        },

        _openDialog: function () {
            var oView = this.getView();

            if (!this.pDialog) {
                this.pDialog = Fragment.load({
                    id: oView.getId(),
                    name: "com.app.zu26g13.app.view.AddShiftDialog",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }

            this.pDialog.then(function (oDialog) {
                oDialog.open();
            });
        },

        onCloseDialog: function () {
            if (this.pDialog) {
                this.pDialog.then(function (oDialog) {
                    oDialog.close();
                });
            }
        },

        // =========================================================
        // CRUD OPERATIONS
        // =========================================================

        onSaveShift: function () {
            var oODataModel = this.getView().getModel();
            var oShiftModel = this.getView().getModel("shiftModel");
            var oShiftData = oShiftModel.getData();

            var sShiftId = String(oShiftData.ShiftId || "").trim().toUpperCase();
            var sStdHours = String(oShiftData.StdHours || "").trim().replace(",", ".");
            var sGraceMins = String(oShiftData.GraceMins || "0").trim();

            if (!sShiftId) {
                MessageBox.error(this._getI18nText("msgMissingShiftId"), { title: this._getI18nText("titleMissingShiftId") });
                return;
            }

            if (!/^[A-Z0-9_]+$/.test(sShiftId)) {
                MessageBox.error(this._getI18nText("msgInvalidShiftIdFormat"), { title: this._getI18nText("titleInvalidShiftId") });
                return;
            }

            if (sShiftId.length > 20) {
                MessageBox.error(this._getI18nText("msgShiftIdTooLong"), { title: this._getI18nText("titleShiftIdTooLong") });
                return;
            }

            if (!sStdHours) {
                MessageBox.error(this._getI18nText("msgMissingStdHours"), { title: this._getI18nText("titleMissingStdHours") });
                return;
            }

            var fStdHours = parseFloat(sStdHours);

            if (isNaN(fStdHours) || fStdHours <= 0 || fStdHours > 24) {
                MessageBox.error(this._getI18nText("msgInvalidStdHours"), { title: this._getI18nText("titleInvalidStdHours") });
                return;
            }

            fStdHours = this._roundHour2(fStdHours);

            var sTimeIn = this._normalizeHHmmss(oShiftData.TimeIn);
            var sTimeOut = this._normalizeHHmmss(oShiftData.TimeOut);

            if (!sTimeIn || !sTimeOut) {
                MessageBox.error(this._getI18nText("msgMissingWorkingTime"), { title: this._getI18nText("titleMissingWorkingTime") });
                return;
            }

            if (!this._isValidHHmmss(sTimeIn) || !this._isValidHHmmss(sTimeOut)) {
                MessageBox.error(this._getI18nText("msgInvalidWorkingTime"), { title: this._getI18nText("titleInvalidWorkingTime") });
                return;
            }

            var bNextDay = !!oShiftData.NextDayBool;
            var fActualHoursRaw = this._calculateShiftHours(sTimeIn, sTimeOut, bNextDay);
            var fActualHours = this._roundHour2(fActualHoursRaw);

            if (fActualHoursRaw <= 0) {
                MessageBox.error(this._getI18nText("msgInvalidTimeRange"), { title: this._getI18nText("titleInvalidTimeRange") });
                return;
            }

            if (fActualHoursRaw > 24) {
                MessageBox.error(this._getI18nText("msgExceed24Hours"), { title: this._getI18nText("titleInvalidTimeRange") });
                return;
            }

            if (Math.abs(fActualHours - fStdHours) > 0.001) {
                var sYes = this._getI18nText("txtYes");
                var sNo = this._getI18nText("txtNo");
                
                MessageBox.error(
                    this._getI18nText("msgStdHoursMismatch", [
                        this._formatTimeFromHHmmss(sTimeIn),
                        this._formatTimeFromHHmmss(sTimeOut),
                        bNextDay ? sYes : sNo,
                        this._formatHourNumber(fActualHours),
                        this._formatHourNumber(fStdHours)
                    ]),
                    { title: this._getI18nText("titleStdHoursMismatch") }
                );
                return;
            }

            var iGraceMins = parseInt(sGraceMins || "0", 10);

            if (isNaN(iGraceMins) || iGraceMins < 0 || iGraceMins > 1440) {
                MessageBox.error(this._getI18nText("msgInvalidGraceMins"), { title: this._getI18nText("titleInvalidGraceMins") });
                return;
            }

            oShiftModel.setProperty("/ShiftId", sShiftId);
            oShiftModel.setProperty("/StdHours", String(fStdHours));
            oShiftModel.setProperty("/TimeIn", sTimeIn);
            oShiftModel.setProperty("/TimeOut", sTimeOut);
            oShiftModel.setProperty("/GraceMins", String(iGraceMins));

            var vNextDayPayload = this._toNextDayPayload(bNextDay);

            var oPayloadCreate = {
                ShiftId: sShiftId,
                StdHours: String(fStdHours),
                TimeIn: this._hhmmssToEdmTime(sTimeIn),
                TimeOut: this._hhmmssToEdmTime(sTimeOut),
                NextDay: vNextDayPayload,
                GraceMins: iGraceMins
            };

            var oPayloadUpdate = {
                StdHours: String(fStdHours),
                TimeIn: this._hhmmssToEdmTime(sTimeIn),
                TimeOut: this._hhmmssToEdmTime(sTimeOut),
                NextDay: vNextDayPayload,
                GraceMins: iGraceMins
            };

            sap.ui.core.BusyIndicator.show(0);

            if (oShiftData.isEdit) {
                this._updateShift(oODataModel, oShiftData, oPayloadUpdate);
                return;
            }

            this._createShift(oODataModel, oPayloadCreate);
        },

        _createShift: function (oODataModel, oPayloadCreate) {
            this._scheduleExists(oODataModel, oPayloadCreate.ShiftId).then(function (bExists) {
                if (bExists) {
                    sap.ui.core.BusyIndicator.hide();
                    MessageBox.error(this._getI18nText("msgDuplicateShiftId", [oPayloadCreate.ShiftId]), {
                        title: this._getI18nText("titleDuplicateShiftId")
                    });
                    return;
                }

                oODataModel.create("/Schedule", oPayloadCreate, {
                    success: function () {
                        sap.ui.core.BusyIndicator.hide();
                        MessageToast.show(this._getI18nText("msgShiftCreated"));
                        this.onCloseDialog();
                        this._publishDataChanged("create");
                        this._reloadViewData();
                    }.bind(this),
                    error: function (oError) {
                        sap.ui.core.BusyIndicator.hide();
                        console.error("Error creating /Schedule:", oError);
                        MessageBox.error(
                            this._getODataErrorMessage(oError, this._getI18nText("msgCreateShiftError")),
                            { title: this._getI18nText("titleCreateShiftError") }
                        );
                    }.bind(this)
                });
            }.bind(this)).catch(function (oError) {
                sap.ui.core.BusyIndicator.hide();
                console.error("Error checking shift existence:", oError);
                MessageBox.error(
                    this._getODataErrorMessage(oError, this._getI18nText("msgCheckShiftIdError")),
                    { title: this._getI18nText("titleCheckShiftIdError") }
                );
            }.bind(this));
        },

        _updateShift: function (oODataModel, oShiftData, oPayloadUpdate) {
            var sPath = oShiftData.sPath || this._buildSchedulePath(oODataModel, oShiftData.ShiftId);

            oODataModel.update(sPath, oPayloadUpdate, {
                success: function () {
                    sap.ui.core.BusyIndicator.hide();
                    MessageToast.show(this._getI18nText("msgShiftUpdated"));
                    this.onCloseDialog();
                    this._publishDataChanged("update");
                    this._reloadViewData();
                }.bind(this),
                error: function (oError) {
                    sap.ui.core.BusyIndicator.hide();
                    console.error("Error updating /Schedule:", oError);
                    MessageBox.error(
                        this._getODataErrorMessage(oError, this._getI18nText("msgUpdateShiftError")),
                        { title: this._getI18nText("titleUpdateShiftError") }
                    );
                }.bind(this)
            });
        },

        onDeleteShift: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();

            if (!oContext) {
                MessageBox.error(this._getI18nText("msgErrorGetDeleteRow"));
                return;
            }

            var oData = oContext.getObject();
            var oODataModel = this.getView().getModel();
            var sPath = this._buildSchedulePath(oODataModel, oData.ShiftId);

            MessageBox.confirm(
                this._getI18nText("msgConfirmDeleteShift", [oData.ShiftId]),
                {
                    title: this._getI18nText("titleConfirmDeleteShift"),
                    actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                    emphasizedAction: MessageBox.Action.OK,
                    onClose: function (sAction) {
                        if (sAction !== MessageBox.Action.OK) {
                            return;
                        }

                        sap.ui.core.BusyIndicator.show(0);

                        oODataModel.remove(sPath, {
                            success: function () {
                                sap.ui.core.BusyIndicator.hide();
                                MessageToast.show(this._getI18nText("msgShiftDeleted"));
                                this._publishDataChanged("delete");
                                this._reloadViewData();
                            }.bind(this),
                            error: function (oError) {
                                sap.ui.core.BusyIndicator.hide();
                                console.error("Error deleting /Schedule:", oError);
                                MessageBox.error(
                                    this._getODataErrorMessage(oError, this._getI18nText("msgDeleteShiftError")),
                                    { title: this._getI18nText("titleDeleteShiftError") }
                                );
                            }.bind(this)
                        });
                    }.bind(this)
                }
            );
        },

        // =========================================================
        // DATA FORMATTING & UTILITIES
        // =========================================================

        _reloadViewData: function () {
            var oODataModel = this.getView().getModel();
            var oTable = this.byId("shiftTable");
            var oBinding = oTable && oTable.getBinding("items");

            if (oODataModel) {
                oODataModel.refresh(true);
                if (oODataModel.updateBindings) {
                    oODataModel.updateBindings(true);
                }
            }

            if (oBinding) {
                oBinding.refresh(true);
            }
        },

        formatODataTime: function (vTime) {
            return this._formatTimeFromHHmmss(this._edmTimeToHHmmss(vTime));
        },

        formatNextDayText: function (vNextDay) {
            return this._isNextDayTrue(vNextDay) ? this._getI18nText("txtYes") : this._getI18nText("txtNo");
        },

        formatNextDayState: function (vNextDay) {
            return this._isNextDayTrue(vNextDay) ? "Warning" : "Success";
        },

        _scheduleExists: function (oODataModel, sShiftId) {
            var sPath = this._buildSchedulePath(oODataModel, sShiftId);

            return new Promise(function (resolve, reject) {
                oODataModel.read(sPath, {
                    success: function () {
                        resolve(true);
                    },
                    error: function (oError) {
                        var iStatusCode = Number(oError && oError.statusCode);
                        if (iStatusCode === 404) {
                            resolve(false);
                            return;
                        }
                        reject(oError);
                    }
                });
            });
        },

        _buildSchedulePath: function (oODataModel, sShiftId) {
            return oODataModel.createKey("/Schedule", {
                ShiftId: String(sShiftId || "").trim().toUpperCase()
            });
        },

        _calculateShiftHours: function (sTimeIn, sTimeOut, bNextDay) {
            var iStartSeconds = this._timeToSeconds(sTimeIn);
            var iEndSeconds = this._timeToSeconds(sTimeOut);

            if (bNextDay) {
                iEndSeconds += 24 * 3600;
            }

            var iDurationSeconds = iEndSeconds - iStartSeconds;
            return iDurationSeconds <= 0 ? 0 : iDurationSeconds / 3600;
        },

        _roundHour2: function (fHours) {
            return Math.round(Number(fHours || 0) * 100) / 100;
        },

        _formatHourNumber: function (fHours) {
            var fRounded = this._roundHour2(fHours);
            if (Math.abs(fRounded - Math.round(fRounded)) < 0.001) {
                return String(Math.round(fRounded));
            }
            return String(fRounded);
        },

        _toNextDayPayload: function (bNextDay) {
            if (this._isSchedulePropertyBoolean("NextDay")) {
                return !!bNextDay;
            }
            return bNextDay ? "X" : "";
        },

        _isNextDayTrue: function (vNextDay) {
            if (vNextDay === true) {
                return true;
            }
            var sValue = String(vNextDay || "").trim().toUpperCase();
            return sValue === "X" || sValue === "TRUE" || sValue === "1";
        },

        _isSchedulePropertyBoolean: function (sPropertyName) {
            var oProperty = this._getScheduleProperty(sPropertyName);
            return oProperty ? oProperty.type === "Edm.Boolean" : false;
        },

        _getScheduleProperty: function (sPropertyName) {
            var oEntityType = this._getScheduleEntityType();
            if (!oEntityType || !oEntityType.property) {
                return null;
            }
            for (var i = 0; i < oEntityType.property.length; i++) {
                if (oEntityType.property[i].name === sPropertyName) {
                    return oEntityType.property[i];
                }
            }
            return null;
        },

        _getScheduleEntityType: function () {
            var oODataModel = this.getView().getModel();
            if (!oODataModel || !oODataModel.getServiceMetadata) {
                return null;
            }
            var oMetadata = oODataModel.getServiceMetadata();
            if (!oMetadata || !oMetadata.dataServices || !oMetadata.dataServices.schema) {
                return null;
            }
            var aSchemas = oMetadata.dataServices.schema;
            var sEntityTypeFullName = "";

            aSchemas.some(function (oSchema) {
                var oContainer = oSchema.entityContainer && oSchema.entityContainer[0];
                if (!oContainer || !oContainer.entitySet) {
                    return false;
                }
                return oContainer.entitySet.some(function (oEntitySet) {
                    if (oEntitySet.name === "Schedule") {
                        sEntityTypeFullName = oEntitySet.entityType;
                        return true;
                    }
                    return false;
                });
            });

            if (!sEntityTypeFullName) {
                return null;
            }

            var aParts = sEntityTypeFullName.split(".");
            var sTypeName = aParts.pop();
            var sNamespace = aParts.join(".");

            for (var i = 0; i < aSchemas.length; i++) {
                var oSchema = aSchemas[i];
                if (oSchema.namespace !== sNamespace || !oSchema.entityType) {
                    continue;
                }
                for (var j = 0; j < oSchema.entityType.length; j++) {
                    if (oSchema.entityType[j].name === sTypeName) {
                        return oSchema.entityType[j];
                    }
                }
            }
            return null;
        },

        _edmTimeToHHmmss: function (vTime) {
            if (!vTime) {
                return "000000";
            }
            if (typeof vTime === "object" && vTime.ms !== undefined) {
                var iTotalSeconds = Math.floor(vTime.ms / 1000);
                var iHours = Math.floor(iTotalSeconds / 3600);
                var iMinutes = Math.floor((iTotalSeconds % 3600) / 60);
                var iSeconds = iTotalSeconds % 60;
                return String(iHours).padStart(2, "0") +
                    String(iMinutes).padStart(2, "0") +
                    String(iSeconds).padStart(2, "0");
            }
            var sTime = String(vTime).trim();
            var aMatch = sTime.match(/^PT(\d+)H(\d+)M(\d+)S$/);
            if (aMatch) {
                return String(aMatch[1]).padStart(2, "0") +
                    String(aMatch[2]).padStart(2, "0") +
                    String(aMatch[3]).padStart(2, "0");
            }
            aMatch = sTime.match(/^PT(\d+)H(\d+)M$/);
            if (aMatch) {
                return String(aMatch[1]).padStart(2, "0") +
                    String(aMatch[2]).padStart(2, "0") +
                    "00";
            }
            return this._normalizeHHmmss(sTime) || "000000";
        },

        _hhmmssToEdmTime: function (sHHMMSS) {
            var sTime = this._normalizeHHmmss(sHHMMSS) || "000000";
            var iHours = parseInt(sTime.substring(0, 2), 10);
            var iMinutes = parseInt(sTime.substring(2, 4), 10);
            var iSeconds = parseInt(sTime.substring(4, 6), 10);
            return {
                __edmType: "Edm.Time",
                ms: ((iHours * 60 * 60) + (iMinutes * 60) + iSeconds) * 1000
            };
        },

        _normalizeHHmmss: function (sTime) {
            if (!sTime) { return ""; }
            sTime = String(sTime).trim();
            if (/^\d{6}$/.test(sTime)) { return sTime; }
            if (/^\d{2}:\d{2}:\d{2}$/.test(sTime)) {
                return sTime.substring(0, 2) + sTime.substring(3, 5) + sTime.substring(6, 8);
            }
            if (/^\d{2}:\d{2}$/.test(sTime)) {
                return sTime.substring(0, 2) + sTime.substring(3, 5) + "00";
            }
            return "";
        },

        _isValidHHmmss: function (sHHMMSS) {
            if (!/^\d{6}$/.test(sHHMMSS)) { return false; }
            var iHours = parseInt(sHHMMSS.substring(0, 2), 10);
            var iMinutes = parseInt(sHHMMSS.substring(2, 4), 10);
            var iSeconds = parseInt(sHHMMSS.substring(4, 6), 10);
            return iHours >= 0 && iHours <= 23 &&
                iMinutes >= 0 && iMinutes <= 59 &&
                iSeconds >= 0 && iSeconds <= 59;
        },

        _timeToSeconds: function (sHHMMSS) {
            return parseInt(sHHMMSS.substring(0, 2), 10) * 3600 +
                parseInt(sHHMMSS.substring(2, 4), 10) * 60 +
                parseInt(sHHMMSS.substring(4, 6), 10);
        },

        _formatTimeFromHHmmss: function (sHHMMSS) {
            var sTime = this._normalizeHHmmss(sHHMMSS);
            return sTime ? sTime.substring(0, 2) + ":" + sTime.substring(2, 4) : "";
        },

        _getODataErrorMessage: function (oError, sDefaultMessage) {
            var aMessages = [];
            var fnAddMessage = function (sMessage) {
                if (!sMessage) { return; }
                sMessage = String(sMessage).trim();
                if (!sMessage || sMessage === "HTTP request failed") { return; }
                if (aMessages.indexOf(sMessage) === -1) {
                    aMessages.push(sMessage);
                }
            };

            try {
                if (oError && oError.responseText) {
                    var oBody = JSON.parse(oError.responseText);
                    if (oBody && oBody.error && oBody.error.innererror && oBody.error.innererror.errordetails && oBody.error.innererror.errordetails.length) {
                        oBody.error.innererror.errordetails.forEach(function (item) {
                            fnAddMessage(item.message);
                        });
                    }
                    if (oBody && oBody.error && oBody.error.message && oBody.error.message.value) {
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

            return aMessages.length > 0 ? aMessages.join("\n") : (sDefaultMessage || this._getI18nText("msgUnexpectedError"));
        }

    });
});