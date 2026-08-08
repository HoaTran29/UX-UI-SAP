sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment"
], function (Controller, JSONModel, MessageBox, MessageToast, Fragment) {
    "use strict";

    return Controller.extend("com.app.zu26g13.app.controller.Holiday", {

        onInit: function () {
            var oODataModel = this.getOwnerComponent().getModel();

            if (oODataModel && oODataModel.setUseBatch) {
                oODataModel.setUseBatch(false);
            }

            this.getView().setModel(
                new JSONModel(this._getDefaultHolidayData()),
                "holidayModel"
            );

            this._attachAutoReloadHandlers();
        },

        // =========================================================
        // HELPER FUNCTIONS
        // =========================================================

        // Lấy text từ i18n, hỗ trợ truyền tham số động (VD: [param1])
        _getI18nText: function (sKey, aArgs) {
            return this.getView().getModel("i18n").getResourceBundle().getText(sKey, aArgs);
        },

        _getDefaultHolidayData: function () {
            return {
                HolDate: new Date(),
                HolDesc: "",
                isEdit: false,
                sPath: ""
            };
        },

        _attachAutoReloadHandlers: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            var oRoute = oRouter && oRouter.getRoute("holiday");

            if (oRoute && !this._bRouteAttached) {
                oRoute.attachPatternMatched(this._reloadViewData, this);
                this._bRouteAttached = true;
            }
        },

        _publishDataChanged: function (sAction) {
            sap.ui.getCore().getEventBus().publish("codesap", "DataChanged", {
                source: "Holiday",
                action: sAction || "refresh",
                timestamp: Date.now()
            });
        },

        // =========================================================
        // DIALOG OPERATIONS
        // =========================================================

        onOpenAddDialog: function () {
            var oHolidayModel = this.getView().getModel("holidayModel");
            oHolidayModel.setData(this._getDefaultHolidayData());
            this._openDialog();
        },

        onEditHoliday: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();

            if (!oContext) {
                MessageBox.error(this._getI18nText("msgErrorGetHolidayData"));
                return;
            }

            var oData = oContext.getObject();
            var oODataModel = this.getView().getModel();

            this.getView().getModel("holidayModel").setData({
                HolDate: this._toDate(oData.HolDate),
                HolDesc: oData.HolDesc || "",
                isEdit: true,
                sPath: this._buildHolidayPath(oODataModel, oData.HolDate)
            });

            this._openDialog();
        },

        _openDialog: function () {
            var oView = this.getView();

            if (!this.pDialog) {
                this.pDialog = Fragment.load({
                    id: oView.getId(),
                    name: "com.app.zu26g13.app.view.AddHolidayDialog",
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

        onSaveHoliday: function () {
            var oODataModel = this.getView().getModel();
            var oHolidayModel = this.getView().getModel("holidayModel");
            var oHolidayData = oHolidayModel.getData();

            var dHolDate = this._toDate(oHolidayData.HolDate);
            var sHolDesc = String(oHolidayData.HolDesc || "").trim();

            if (!dHolDate) {
                MessageBox.error(this._getI18nText("msgSelectHolidayDate"), {
                    title: this._getI18nText("titleMissingDate")
                });
                return;
            }

            if (!sHolDesc) {
                MessageBox.error(this._getI18nText("msgMissingDesc"), {
                    title: this._getI18nText("titleMissingDesc")
                });
                return;
            }

            oHolidayModel.setProperty("/HolDesc", sHolDesc);

            var oPayloadCreate = {
                HolDate: this._toODataDate(dHolDate),
                HolDesc: sHolDesc
            };

            var oPayloadUpdate = {
                HolDesc: sHolDesc
            };

            sap.ui.core.BusyIndicator.show(0);

            if (oHolidayData.isEdit) {
                var sUpdatePath = oHolidayData.sPath || this._buildHolidayPath(oODataModel, dHolDate);

                oODataModel.update(sUpdatePath, oPayloadUpdate, {
                    success: function () {
                        sap.ui.core.BusyIndicator.hide();
                        MessageToast.show(this._getI18nText("msgHolidayUpdated"));
                        this.onCloseDialog();
                        this._publishDataChanged("update");
                        this._reloadViewData();
                    }.bind(this),
                    error: function (oError) {
                        sap.ui.core.BusyIndicator.hide();
                        console.error("Error updating /Holiday:", oError);
                        MessageBox.error(
                            this._getODataErrorMessage(oError, this._getI18nText("msgUpdateHolidayError")),
                            { title: this._getI18nText("titleUpdateError") }
                        );
                    }.bind(this)
                });
                return;
            }

            oODataModel.create("/Holiday", oPayloadCreate, {
                success: function () {
                    sap.ui.core.BusyIndicator.hide();
                    MessageToast.show(this._getI18nText("msgHolidayCreated"));
                    this.onCloseDialog();
                    this._publishDataChanged("create");
                    this._reloadViewData();
                }.bind(this),
                error: function (oError) {
                    sap.ui.core.BusyIndicator.hide();
                    console.error("Error creating /Holiday:", oError);
                    MessageBox.error(
                        this._getODataErrorMessage(oError, this._getI18nText("msgCreateHolidayError")),
                        { title: this._getI18nText("titleCreateError") }
                    );
                }.bind(this)
            });
        },

        onDeleteHoliday: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();

            if (!oContext) {
                MessageBox.error(this._getI18nText("msgErrorGetDeleteRow"));
                return;
            }

            var oData = oContext.getObject();
            var oODataModel = this.getView().getModel();
            var sPath = this._buildHolidayPath(oODataModel, oData.HolDate);

            MessageBox.confirm(
                this._getI18nText("msgConfirmDeleteHoliday", [this.formatDate(oData.HolDate)]),
                {
                    title: this._getI18nText("titleConfirmDeleteHoliday"),
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
                                MessageToast.show(this._getI18nText("msgHolidayDeleted"));
                                this._publishDataChanged("delete");
                                this._reloadViewData();
                            }.bind(this),
                            error: function (oError) {
                                sap.ui.core.BusyIndicator.hide();
                                console.error("Error deleting /Holiday:", oError);
                                MessageBox.error(
                                    this._getODataErrorMessage(oError, this._getI18nText("msgDeleteHolidayError")),
                                    { title: this._getI18nText("titleDeleteError") }
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
            var oTable = this.byId("holidayTable");
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

        formatDate: function (vDate) {
            var dDate = this._toDate(vDate);
            if (!dDate) {
                return "";
            }
            return dDate.toLocaleDateString("en-GB", {
                timeZone: "Asia/Ho_Chi_Minh",
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            });
        },

        _toDate: function (vDate) {
            if (!vDate) {
                return null;
            }
            if (vDate instanceof Date) {
                return vDate;
            }
            if (typeof vDate === "string" && vDate.indexOf("/Date(") === 0) {
                var iTime = parseInt(vDate.replace(/\D/g, ""), 10);
                return new Date(iTime);
            }
            return new Date(vDate);
        },

        _normalizeDate: function (vDate) {
            var dDate = this._toDate(vDate);
            if (!dDate) {
                return null;
            }
            dDate = new Date(dDate);
            dDate.setHours(0, 0, 0, 0);
            return dDate;
        },

        /*
         * Format date to UTC 00:00:00 to prevent GMT+7 shifting during OData payload submission
         */
        _toODataDate: function (vDate) {
            var dDate = this._normalizeDate(vDate);
            if (!dDate) {
                return null;
            }
            return new Date(Date.UTC(dDate.getFullYear(), dDate.getMonth(), dDate.getDate(), 0, 0, 0));
        },

        _buildHolidayPath: function (oODataModel, vHolDate) {
            return oODataModel.createKey("/Holiday", {
                HolDate: this._toODataDate(vHolDate)
            });
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

            if (aMessages.length > 0) {
                return aMessages.join("\n");
            }

            return sDefaultMessage || this._getI18nText("msgUnexpectedError");
        }

    });
});