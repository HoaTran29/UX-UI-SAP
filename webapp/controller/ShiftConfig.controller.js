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
            if (oODataModel && oODataModel.setUseBatch) oODataModel.setUseBatch(false);

            this.getView().setModel(new JSONModel(this._getDefaultShiftData()), "shiftModel");
            this.getView().setModel(new JSONModel({ payTypes: [] }), "payTypeModel");
            
            this._loadPayTypes();

            var oRouter = this.getOwnerComponent().getRouter();
            if (oRouter.getRoute("shiftConfig") && !this._bRouteAttached) {
                oRouter.getRoute("shiftConfig").attachPatternMatched(this._reloadViewData, this);
                this._bRouteAttached = true;
            }
        },

        _loadPayTypes: function () {
            this.getOwnerComponent().getModel().read("/PayTypeConfig", {
                success: function (oData) {
                    this.getView().getModel("payTypeModel").setProperty("/payTypes", oData.results || []);
                }.bind(this)
            });
        },

        _getI18nText: function (sKey, aArgs) {
            return this.getView().getModel("i18n").getResourceBundle().getText(sKey, aArgs);
        },

        _getDefaultShiftData: function () {
            return {
                ShiftId: "", StdHours: "8", TimeIn: "070000", TimeOut: "150000",
                StdPayCode: "", WeekendPayCode: "", OtPayCode: "",
                NextDay: "", NextDayBool: false, GraceMins: "0", isEdit: false, sPath: ""
            };
        },

        _publishDataChanged: function (sAction) {
            sap.ui.getCore().getEventBus().publish("codesap", "DataChanged", {
                source: "Shift", action: sAction || "refresh", timestamp: Date.now()
            });
        },

        // =========================================================
        // quản lý popup
        // =========================================================
        onOpenAddDialog: function () {
            var oDefaultData = this._getDefaultShiftData();
            var aPayTypes = this.getView().getModel("payTypeModel").getProperty("/payTypes");

            if (aPayTypes && aPayTypes.length > 0) {
                oDefaultData.StdPayCode = aPayTypes[0].PayCode;
                oDefaultData.WeekendPayCode = aPayTypes[0].PayCode;
                oDefaultData.OtPayCode = aPayTypes[0].PayCode;
            }
            this.getView().getModel("shiftModel").setData(this._getDefaultShiftData());
            this._openDialog();
        },

        onEditShift: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            if (!oContext) return MessageBox.error(this._getI18nText("msgErrorGetShiftData"));

            var oData = oContext.getObject();
            this.getView().getModel("shiftModel").setData({
                ShiftId: oData.ShiftId || "",
                StdHours: oData.StdHours != null ? String(oData.StdHours) : "8",
                TimeIn: this._edmTimeToHHmmss(oData.TimeIn),
                TimeOut: this._edmTimeToHHmmss(oData.TimeOut),
                StdPayCode: oData.StdPayCode || "",
                WeekendPayCode: oData.WeekendPayCode || "",
                OtPayCode: oData.OtPayCode || "",
                NextDay: oData.NextDay,
                NextDayBool: this._isNextDayTrue(oData.NextDay),
                GraceMins: oData.GraceMins != null ? String(oData.GraceMins) : "0",
                isEdit: true,
                sPath: this._buildSchedulePath(this.getView().getModel(), oData.ShiftId)
            });

            this._openDialog();
        },

        _openDialog: function () {
            var oView = this.getView();
            if (!this.pDialog) {
                this.pDialog = Fragment.load({
                    id: oView.getId(), name: "com.app.zu26g13.app.view.AddShiftDialog", controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }
            this.pDialog.then(function (oDialog) { oDialog.open(); });
        },

        onCloseDialog: function () {
            if (this.pDialog) this.pDialog.then(function (oDialog) { oDialog.close(); });
        },

        // =========================================================
        // thêm, sửa, xóa
        // =========================================================
        onSaveShift: function () {
            var oODataModel = this.getView().getModel();
            var oShiftData = this.getView().getModel("shiftModel").getData();
            
            var sShiftId = String(oShiftData.ShiftId || "").trim().toUpperCase();
            var sStdHours = String(oShiftData.StdHours || "").trim().replace(",", ".");
            var sGraceMins = String(oShiftData.GraceMins || "0").trim();
            var bNextDay = !!oShiftData.NextDayBool;

            // validate các trường nhập liệu
            if (!sShiftId) return MessageBox.error(this._getI18nText("msgMissingShiftId"), { title: this._getI18nText("titleMissingShiftId") });
            if (!/^[A-Z0-9_]+$/.test(sShiftId)) return MessageBox.error(this._getI18nText("msgInvalidShiftIdFormat"), { title: this._getI18nText("titleInvalidShiftId") });
            if (sShiftId.length > 20) return MessageBox.error(this._getI18nText("msgShiftIdTooLong"), { title: this._getI18nText("titleShiftIdTooLong") });
            if (!sStdHours) return MessageBox.error(this._getI18nText("msgMissingStdHours"), { title: this._getI18nText("titleMissingStdHours") });
            if (!oShiftData.StdPayCode || !oShiftData.WeekendPayCode || !oShiftData.OtPayCode) return MessageBox.error(this._getI18nText("msgMissingPayCode"), { title: "Error" });

            var fStdHours = parseFloat(sStdHours);
            if (isNaN(fStdHours) || fStdHours <= 0 || fStdHours > 24) return MessageBox.error(this._getI18nText("msgInvalidStdHours"), { title: this._getI18nText("titleInvalidStdHours") });
            fStdHours = Math.round(fStdHours * 100) / 100;

            var sTimeIn = this._normalizeHHmmss(oShiftData.TimeIn);
            var sTimeOut = this._normalizeHHmmss(oShiftData.TimeOut);
            
            if (!sTimeIn || !sTimeOut) return MessageBox.error(this._getI18nText("msgMissingWorkingTime"), { title: this._getI18nText("titleMissingWorkingTime") });
            if (!this._isValidHHmmss(sTimeIn) || !this._isValidHHmmss(sTimeOut)) return MessageBox.error(this._getI18nText("msgInvalidWorkingTime"), { title: this._getI18nText("titleInvalidWorkingTime") });

            // kiểm tra logic tính giờ
            var fActualHoursRaw = this._calculateShiftHours(sTimeIn, sTimeOut, bNextDay);
            var fActualHours = Math.round(fActualHoursRaw * 100) / 100;

            if (fActualHoursRaw <= 0) return MessageBox.error(this._getI18nText("msgInvalidTimeRange"), { title: this._getI18nText("titleInvalidTimeRange") });
            if (fActualHoursRaw > 24) return MessageBox.error(this._getI18nText("msgExceed24Hours"), { title: this._getI18nText("titleInvalidTimeRange") });
            
            if (Math.abs(fActualHours - fStdHours) > 0.001) {
                return MessageBox.error(
                    this._getI18nText("msgStdHoursMismatch", [ this._formatTimeFromHHmmss(sTimeIn), this._formatTimeFromHHmmss(sTimeOut), bNextDay ? this._getI18nText("txtYes") : this._getI18nText("txtNo"), String(fActualHours), String(fStdHours) ]),
                    { title: this._getI18nText("titleStdHoursMismatch") }
                );
            }

            var iGraceMins = parseInt(sGraceMins, 10);
            if (isNaN(iGraceMins) || iGraceMins < 0 || iGraceMins > 1440) return MessageBox.error(this._getI18nText("msgInvalidGraceMins"), { title: this._getI18nText("titleInvalidGraceMins") });

            // đóng gói payload
            var oPayload = {
                StdHours: String(fStdHours),
                TimeIn: this._hhmmssToEdmTime(sTimeIn),
                TimeOut: this._hhmmssToEdmTime(sTimeOut),
                NextDay: this._toNextDayPayload(bNextDay),
                GraceMins: iGraceMins,
                StdPayCode: oShiftData.StdPayCode,
                WeekendPayCode: oShiftData.WeekendPayCode,
                OtPayCode: oShiftData.OtPayCode
            };

            sap.ui.core.BusyIndicator.show(0);

            if (oShiftData.isEdit) {
                this._updateShift(oODataModel, oShiftData.sPath || this._buildSchedulePath(oODataModel, sShiftId), oPayload);
            } else {
                oPayload.ShiftId = sShiftId;
                this._createShift(oODataModel, oPayload);
            }
        },

        _createShift: function (oODataModel, oPayloadCreate) {
            // check trùng mã ca trước khi tạo
            this._scheduleExists(oODataModel, oPayloadCreate.ShiftId).then(function (bExists) {
                if (bExists) {
                    sap.ui.core.BusyIndicator.hide();
                    return MessageBox.error(this._getI18nText("msgDuplicateShiftId", [oPayloadCreate.ShiftId]), { title: this._getI18nText("titleDuplicateShiftId") });
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
                        MessageBox.error(this._getODataErrorMessage(oError, this._getI18nText("msgCreateShiftError")), { title: this._getI18nText("titleCreateShiftError") });
                    }.bind(this)
                });
            }.bind(this)).catch(function (oError) {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.error(this._getODataErrorMessage(oError, this._getI18nText("msgCheckShiftIdError")), { title: this._getI18nText("titleCheckShiftIdError") });
            }.bind(this));
        },

        _updateShift: function (oODataModel, sPath, oPayloadUpdate) {
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
                    MessageBox.error(this._getODataErrorMessage(oError, this._getI18nText("msgUpdateShiftError")), { title: this._getI18nText("titleUpdateShiftError") });
                }.bind(this)
            });
        },

        onDeleteShift: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            if (!oContext) return MessageBox.error(this._getI18nText("msgErrorGetDeleteRow"));

            var oData = oContext.getObject();
            var oODataModel = this.getView().getModel();
            var sPath = this._buildSchedulePath(oODataModel, oData.ShiftId);

            MessageBox.confirm(this._getI18nText("msgConfirmDeleteShift", [oData.ShiftId]), {
                title: this._getI18nText("titleConfirmDeleteShift"),
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.OK,
                onClose: function (sAction) {
                    if (sAction !== MessageBox.Action.OK) return;

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
                            MessageBox.error(this._getODataErrorMessage(oError, this._getI18nText("msgDeleteShiftError")), { title: this._getI18nText("titleDeleteShiftError") });
                        }.bind(this)
                    });
                }.bind(this)
            });
        },

        // =========================================================
        // format và tiện ích (utilities)
        // =========================================================
        _reloadViewData: function () {
            var oODataModel = this.getView().getModel();
            if (oODataModel) oODataModel.refresh(true);
            
            var oTable = this.byId("shiftTable");
            if (oTable && oTable.getBinding("items")) oTable.getBinding("items").refresh(true);
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
                    success: function () { resolve(true); },
                    error: function (oError) {
                        if (Number(oError && oError.statusCode) === 404) resolve(false);
                        else reject(oError);
                    }
                });
            });
        },

        _buildSchedulePath: function (oODataModel, sShiftId) {
            return oODataModel.createKey("/Schedule", { ShiftId: String(sShiftId || "").trim().toUpperCase() });
        },

        _calculateShiftHours: function (sTimeIn, sTimeOut, bNextDay) {
            var iStart = parseInt(sTimeIn.substring(0, 2), 10) * 3600 + parseInt(sTimeIn.substring(2, 4), 10) * 60;
            var iEnd = parseInt(sTimeOut.substring(0, 2), 10) * 3600 + parseInt(sTimeOut.substring(2, 4), 10) * 60;
            if (bNextDay) iEnd += 24 * 3600;
            return (iEnd - iStart) <= 0 ? 0 : (iEnd - iStart) / 3600;
        },

        _toNextDayPayload: function (bNextDay) {
            var oType = this._getScheduleEntityType();
            var bIsBoolean = oType && oType.property && oType.property.some(function(p) { return p.name === "NextDay" && p.type === "Edm.Boolean"; });
            return bIsBoolean ? !!bNextDay : (bNextDay ? "X" : "");
        },

        _isNextDayTrue: function (vNextDay) {
            if (vNextDay === true) return true;
            var sValue = String(vNextDay || "").trim().toUpperCase();
            return sValue === "X" || sValue === "TRUE" || sValue === "1";
        },

        _getScheduleEntityType: function () {
            var oMeta = this.getView().getModel().getServiceMetadata();
            if (!oMeta || !oMeta.dataServices || !oMeta.dataServices.schema) return null;
            var oType = null;
            oMeta.dataServices.schema.forEach(function (oSchema) {
                if (oSchema.entityType) oSchema.entityType.forEach(function(e) { if (e.name === "ScheduleType") oType = e; });
            });
            return oType;
        },

        // bóc giờ từ định dạng odata pt..h..m..s
        _edmTimeToHHmmss: function (vTime) {
            if (!vTime) return "000000";
            if (vTime.ms !== undefined) {
                var s = Math.floor(vTime.ms / 1000);
                return String(Math.floor(s / 3600)).padStart(2, "0") + String(Math.floor((s % 3600) / 60)).padStart(2, "0") + String(s % 60).padStart(2, "0");
            }
            var sTime = String(vTime).trim();
            var aMatch = sTime.match(/^PT(\d+)H(\d+)M(\d+)S$/) || sTime.match(/^PT(\d+)H(\d+)M$/);
            if (aMatch) return String(aMatch[1]).padStart(2, "0") + String(aMatch[2]).padStart(2, "0") + (aMatch[3] ? String(aMatch[3]).padStart(2, "0") : "00");
            return this._normalizeHHmmss(sTime) || "000000";
        },

        _hhmmssToEdmTime: function (sHHMMSS) {
            var sTime = this._normalizeHHmmss(sHHMMSS) || "000000";
            return { __edmType: "Edm.Time", ms: (parseInt(sTime.substring(0, 2), 10) * 3600 + parseInt(sTime.substring(2, 4), 10) * 60 + parseInt(sTime.substring(4, 6), 10)) * 1000 };
        },

        _normalizeHHmmss: function (sTime) {
            if (!sTime) return "";
            sTime = String(sTime).trim();
            if (/^\d{6}$/.test(sTime)) return sTime;
            if (/^\d{2}:\d{2}:\d{2}$/.test(sTime)) return sTime.substring(0, 2) + sTime.substring(3, 5) + sTime.substring(6, 8);
            if (/^\d{2}:\d{2}$/.test(sTime)) return sTime.substring(0, 2) + sTime.substring(3, 5) + "00";
            return "";
        },

        _isValidHHmmss: function (sHHMMSS) {
            if (!/^\d{6}$/.test(sHHMMSS)) return false;
            var h = parseInt(sHHMMSS.substring(0, 2), 10), m = parseInt(sHHMMSS.substring(2, 4), 10), s = parseInt(sHHMMSS.substring(4, 6), 10);
            return h >= 0 && h <= 23 && m >= 0 && m <= 59 && s >= 0 && s <= 59;
        },

        _formatTimeFromHHmmss: function (sHHMMSS) {
            var sTime = this._normalizeHHmmss(sHHMMSS);
            return sTime ? sTime.substring(0, 2) + ":" + sTime.substring(2, 4) : "";
        },

        _getODataErrorMessage: function (oError, sDefaultMessage) {
            try {
                if (oError && oError.responseText) {
                    var oBody = JSON.parse(oError.responseText);
                    if (oBody && oBody.error && oBody.error.message && oBody.error.message.value) return oBody.error.message.value;
                }
            } catch (e) {}
            return sDefaultMessage || this._getI18nText("msgUnexpectedError");
        }
    });
});