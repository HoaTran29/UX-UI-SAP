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
        },

        _getDefaultHolidayData: function () {
            return {
                HolDate: new Date(),
                HolDesc: "",
                isEdit: false,
                sPath: ""
            };
        },

        onOpenAddDialog: function () {
            var oHolidayModel = this.getView().getModel("holidayModel");

            oHolidayModel.setData(this._getDefaultHolidayData());

            this._openDialog();
        },

        onEditHoliday: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();

            if (!oContext) {
                MessageBox.error("Unable to get holiday data.");
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

        onSaveHoliday: function () {
            var oODataModel = this.getView().getModel();
            var oHolidayModel = this.getView().getModel("holidayModel");
            var oHolidayData = oHolidayModel.getData();

            var dHolDate = this._toDate(oHolidayData.HolDate);
            var sHolDesc = String(oHolidayData.HolDesc || "").trim();

            if (!dHolDate) {
                MessageBox.error("Please select a holiday date.", {
                    title: "Missing Holiday Date"
                });
                return;
            }

            if (!sHolDesc) {
                MessageBox.error("Holiday description cannot be empty or spaces only.", {
                    title: "Missing Description"
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
                var sUpdatePath = oHolidayData.sPath || this._buildHolidayPath(
                    oODataModel,
                    dHolDate
                );

                oODataModel.update(sUpdatePath, oPayloadUpdate, {
                    success: function () {
                        sap.ui.core.BusyIndicator.hide();
                        MessageToast.show("Holiday updated successfully.");
                        this.onCloseDialog();
                        this._reloadViewData();
                    }.bind(this),
                    error: function (oError) {
                        sap.ui.core.BusyIndicator.hide();
                        console.error("Error updating /Holiday:", oError);
                        MessageBox.error(
                            this._getODataErrorMessage(oError, "Unable to update holiday."),
                            {
                                title: "Unable to Update Holiday"
                            }
                        );
                    }.bind(this)
                });

                return;
            }

            oODataModel.create("/Holiday", oPayloadCreate, {
                success: function () {
                    sap.ui.core.BusyIndicator.hide();
                    MessageToast.show("Holiday created successfully.");
                    this.onCloseDialog();
                    this._reloadViewData();
                }.bind(this),
                error: function (oError) {
                    sap.ui.core.BusyIndicator.hide();
                    console.error("Error creating /Holiday:", oError);
                    MessageBox.error(
                        this._getODataErrorMessage(
                            oError,
                            "Unable to create holiday. Please check whether the holiday date already exists."
                        ),
                        {
                            title: "Unable to Create Holiday"
                        }
                    );
                }.bind(this)
            });
        },

        onDeleteHoliday: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();

            if (!oContext) {
                MessageBox.error("Unable to get the selected row for deletion.");
                return;
            }

            var oData = oContext.getObject();
            var oODataModel = this.getView().getModel();

            var sPath = this._buildHolidayPath(
                oODataModel,
                oData.HolDate
            );

            MessageBox.confirm(
                "Are you sure you want to delete holiday " + this.formatDate(oData.HolDate) + "?",
                {
                    title: "Confirm Deletion",
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
                                MessageToast.show("Holiday deleted successfully.");
                                this._reloadViewData();
                            },
                            error: function (oError) {
                                sap.ui.core.BusyIndicator.hide();
                                console.error("Error deleting /Holiday:", oError);
                                MessageBox.error(
                                    this._getODataErrorMessage(oError, "Unable to delete holiday."),
                                    {
                                        title: "Unable to Delete Holiday"
                                    }
                                );
                            }.bind(this)
                        });
                    }.bind(this)
                }
            );
        },


        _reloadViewData: function () {
            var oODataModel = this.getView().getModel();
            var oTable = this.byId("holidayTable");
            var oBinding = oTable && oTable.getBinding("items");

            if (oODataModel) {
                oODataModel.refresh(true);
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
         * Important:
         * Send date as UTC 00:00 so OData does not shift the date back in GMT+7.
         * Example: selecting 21/07/2026 sends datetime'2026-07-21T00:00:00'.
         */
        _toODataDate: function (vDate) {
            var dDate = this._normalizeDate(vDate);

            if (!dDate) {
                return null;
            }

            return new Date(Date.UTC(
                dDate.getFullYear(),
                dDate.getMonth(),
                dDate.getDate(),
                0,
                0,
                0
            ));
        },

        _buildHolidayPath: function (oODataModel, vHolDate) {
            return oODataModel.createKey("/Holiday", {
                HolDate: this._toODataDate(vHolDate)
            });
        },

        _getODataErrorMessage: function (oError, sDefaultMessage) {
            var aMessages = [];

            var fnAddMessage = function (sMessage) {
                if (!sMessage) {
                    return;
                }

                sMessage = String(sMessage).trim();

                if (!sMessage) {
                    return;
                }

                if (sMessage === "HTTP request failed") {
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

            if (aMessages.length > 0) {
                return aMessages.join("\n");
            }

            return sDefaultMessage || "An unexpected error occurred.";
        }

    });
});