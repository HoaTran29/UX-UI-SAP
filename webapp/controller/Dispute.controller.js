sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/ui/core/BusyIndicator",
    "sap/ui/core/Fragment"
], function (Controller, MessageToast, BusyIndicator, Fragment) {
    "use strict";

    return Controller.extend("com.app.zu26g13.app.controller.Dispute", {

        onInit: function () {
        },

        // Helper to get text from i18n properties
        _getI18nText: function (sKey) {
            return this.getView().getModel("i18n").getResourceBundle().getText(sKey);
        },

        // ==============================================================
        // APPROVAL LOGIC
        // ==============================================================

        // 1. Open Approval Dialog
        onOpenDialog: function (oEvent) {
            var oView = this.getView();
            var oContext = oEvent.getSource().getBindingContext();

            if (!this._pApproveDialog) {
                this._pApproveDialog = Fragment.load({
                    id: oView.getId(),
                    name: "com.app.zu26g13.app.view.ApproveDialog",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }
            this._pApproveDialog.then(function (oDialog) {
                oDialog.setBindingContext(oContext);
                oDialog.open();
            });
        },

        // 2. Cancel & Close Approval Dialog
        onCancelDialog: function () {
            this.getView().getModel().resetChanges();
            this.byId("approveDialog").close();
        },

        // 3. Confirm Approval
        onConfirmApprove: function () {
            var oView = this.getView();
            var oDialog = this.byId("approveDialog");
            var oContext = oDialog.getBindingContext();
            var oModel = this.getView().getModel();
            var sDisputeId = oContext.getProperty("DisputeId");

            var oTextArea = this.byId("approveNoteInput");
            if (oTextArea) {
                var sNote = oTextArea.getValue().trim();

                // Default logic: Auto-fill "APPROVED" if note is empty
                if (!sNote) {
                    sNote = "APPROVED";
                    oTextArea.setValue(sNote);
                }
                oModel.setProperty(oContext.getPath() + "/ApproverComment", sNote); 
            }

            BusyIndicator.show(0);

            if (oModel.hasPendingChanges()) {
                oModel.submitChanges({
                    success: function () {
                        this._callApproveAction(sDisputeId, oModel, oDialog);
                    }.bind(this),
                    error: function () {
                        BusyIndicator.hide();
                        MessageToast.show(this._getI18nText("msgSaveError"));
                    }.bind(this)
                });
            } else {
                this._callApproveAction(sDisputeId, oModel, oDialog);
            }
        },

        // 4. Call Backend Approve Action
        _callApproveAction: function (sDisputeId, oModel, oDialog) {
            oModel.callFunction("/Approve", { 
                method: "POST",
                urlParameters: { DisputeId: sDisputeId },
                success: function () {
                    BusyIndicator.hide();
                    MessageToast.show(this._getI18nText("msgApproveSuccess"));
                    if (oDialog) oDialog.close();
                    oModel.refresh();
                }.bind(this),
                error: function (oError) {
                    BusyIndicator.hide();
                    MessageToast.show(this._getI18nText("msgApproveError"));
                }.bind(this)
            });
        },

        // ==============================================================
        // REJECTION LOGIC
        // ==============================================================

        // 1. Open Reject Dialog
        onOpenRejectDialog: function (oEvent) {
            var oView = this.getView();
            var oContext = oEvent.getSource().getBindingContext();

            if (!this._pRejectDialog) {
                this._pRejectDialog = Fragment.load({
                    id: oView.getId(),
                    name: "com.app.zu26g13.app.view.RejectDialog",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }
            this._pRejectDialog.then(function (oDialog) {
                oDialog.setBindingContext(oContext);
                oDialog.open();
            });
        },

        // 2. Cancel & Close Reject Dialog
        onCancelReject: function () {
            this.getView().getModel().resetChanges();
            this.byId("rejectDialog").close();
        },

        // 3. Confirm Rejection
        onConfirmReject: function () {
            var oView = this.getView();
            var oDialog = this.byId("rejectDialog");
            var oContext = oDialog.getBindingContext();
            var oModel = this.getView().getModel();
            var sDisputeId = oContext.getProperty("DisputeId");

            var oTextArea = this.byId("rejectReasonInput");
            var sReason = oTextArea.getValue().trim();

            if (!sReason) {
                MessageToast.show(this._getI18nText("msgRejectEmptyReason"));
                oTextArea.setValueState("Error");
                return;
            } else {
                oTextArea.setValueState("None");
            }

            if (oTextArea) {
                var sNote = oTextArea.getValue();
                oModel.setProperty(oContext.getPath() + "/ApproverComment", sNote);
            }

            BusyIndicator.show(0);

            if (oModel.hasPendingChanges()) {
                oModel.submitChanges({
                    success: function () {
                        this._callRejectAction(sDisputeId, oModel, oDialog);
                    }.bind(this),
                    error: function () {
                        BusyIndicator.hide();
                        MessageToast.show(this._getI18nText("msgRejectSaveError"));
                    }.bind(this)
                });
            } else {
                this._callRejectAction(sDisputeId, oModel, oDialog);
            }
        },

        // 4. Call Backend Reject Action
        _callRejectAction: function (sDisputeId, oModel, oDialog) {
            oModel.callFunction("/Reject", {
                method: "POST",
                urlParameters: { DisputeId: sDisputeId },
                success: function () {
                    BusyIndicator.hide();
                    MessageToast.show(this._getI18nText("msgRejectSuccess"));
                    if (oDialog) {
                        oDialog.close();
                    }
                    oModel.refresh();
                }.bind(this),
                error: function (oError) {
                    BusyIndicator.hide();
                    MessageToast.show(this._getI18nText("msgRejectError"));
                }.bind(this)
            });
        }
    });
});