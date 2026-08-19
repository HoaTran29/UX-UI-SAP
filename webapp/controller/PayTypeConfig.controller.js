sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (Controller, Filter, FilterOperator, JSONModel, Fragment, MessageBox, MessageToast) {
    "use strict";

    return Controller.extend("com.app.zu26g13.app.controller.PayTypeConfig", {

        onInit: function () {
            this.getView().setModel(new JSONModel({}), "localModel");
        },

        _getI18nText: function (sKey) {
            return this.getView().getModel("i18n").getResourceBundle().getText(sKey);
        },

        // ==========================================
        // 1. SEARCH & FILTER
        // ==========================================
        onSearch: function () {
            var aFilters = [];
            var sCode = this.byId("fltPayCode").getValue();
            var sDesc = this.byId("fltPayDesc").getValue();

            if (sCode) {
                aFilters.push(new Filter("PayCode", FilterOperator.Contains, sCode));
            }
            if (sDesc) {
                aFilters.push(new Filter("PayDesc", FilterOperator.Contains, sDesc));
            }

            var oTable = this.byId("payTypeTable");
            oTable.getBinding("items").filter(aFilters);
        },

        onClear: function () {
            this.byId("fltPayCode").setValue("");
            this.byId("fltPayDesc").setValue("");
            this.onSearch();
        },

        // ==========================================
        // 2. OPEN DIALOGS
        // ==========================================
        _openDialog: function () {
            var oView = this.getView();
            if (!this._pDialog) {
                this._pDialog = Fragment.load({
                    id: oView.getId(),
                    name: "com.app.zu26g13.app.view.PayTypeDialog", 
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }
            this._pDialog.then(function(oDialog) {
                oDialog.open();
            });
        },

        onCreatePress: function () {
            var oLocalModel = this.getView().getModel("localModel");
            oLocalModel.setData({
                title: this._getI18nText("titleCreatePayRate"),
                isNew: true,
                PayCode: "",
                RateFactor: "1.0",
                PayDesc: ""
            });
            this._openDialog();
        },

        onEditPress: function (oEvent) {
            var oItem = oEvent.getSource().getParent().getParent(); 
            var oData = oItem.getBindingContext().getObject();      
            var oLocalModel = this.getView().getModel("localModel");
            
            oLocalModel.setData({
                title: this._getI18nText("titleEditPayRate") + " " + oData.PayCode,
                isNew: false, 
                path: oItem.getBindingContext().getPath(),
                PayCode: oData.PayCode,
                RateFactor: oData.RateFactor,
                PayDesc: oData.PayDesc
            });
            this._openDialog();
        },

        onCancelDialog: function () {
            this.byId("dlgPayType").close();
        },

        // ==========================================
        // 3. SAVE (VALIDATION INCLUDED) & DELETE
        // ==========================================
        onSaveDialog: function () {
            var oModel = this.getView().getModel();
            var oLocalData = this.getView().getModel("localModel").getData();
            var that = this;

            // --- FE VALIDATION START ---
            var sPayCode = String(oLocalData.PayCode || "").trim().toUpperCase();
            var sPayDesc = String(oLocalData.PayDesc || "").trim();
            var fRateFactor = parseFloat(oLocalData.RateFactor);

            if (!sPayCode) {
                MessageBox.error("Mã hệ số (Pay Code) không được để trống!");
                return;
            }
            if (sPayCode.length > 4) {
                MessageBox.error("Mã hệ số không được dài quá 4 ký tự!");
                return;
            }
            if (!sPayDesc) {
                MessageBox.error("Vui lòng nhập mô tả cho hệ số này!");
                return;
            }
            if (isNaN(fRateFactor) || fRateFactor <= 0) {
                MessageBox.error("Hệ số (Rate Factor) phải là một số lớn hơn 0!");
                return;
            }
            // --- FE VALIDATION END ---

            var oPayload = {
                PayCode: sPayCode,
                PayDesc: sPayDesc,
                RateFactor: String(fRateFactor)
            };

            sap.ui.core.BusyIndicator.show(0); // Hiển thị loading

            if (oLocalData.isNew) {
                oModel.create("/PayTypeConfig", oPayload, {
                    success: function () {
                        sap.ui.core.BusyIndicator.hide();
                        MessageToast.show(that._getI18nText("msgCreatePayRateSuccess"));
                        that.onCancelDialog();
                    },
                    error: function (oError) {
                        sap.ui.core.BusyIndicator.hide();
                        MessageBox.error(that._getI18nText("msgCreatePayRateError"));
                    }
                });
            } else {
                oModel.update(oLocalData.path, oPayload, {
                    success: function () {
                        sap.ui.core.BusyIndicator.hide();
                        MessageToast.show(that._getI18nText("msgUpdatePayRateSuccess"));
                        that.onCancelDialog();
                    },
                    error: function (oError) {
                        sap.ui.core.BusyIndicator.hide();
                        MessageBox.error(that._getI18nText("msgUpdatePayRateError"));
                    }
                });
            }
        },

        onDeletePress: function (oEvent) {
            var oItem = oEvent.getSource().getParent().getParent();
            var sPath = oItem.getBindingContext().getPath();
            var oModel = this.getView().getModel();
            var that = this; 

            MessageBox.confirm(this._getI18nText("msgConfirmDeletePayRate"), {
                icon: MessageBox.Icon.WARNING,
                title: this._getI18nText("titleConfirmDelete"), 
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        sap.ui.core.BusyIndicator.show(0);
                        oModel.remove(sPath, {
                            success: function () {
                                sap.ui.core.BusyIndicator.hide();
                                MessageToast.show(that._getI18nText("msgDeletePayRateSuccess"));
                            },
                            error: function () {
                                sap.ui.core.BusyIndicator.hide();
                                MessageBox.error(that._getI18nText("msgDeletePayRateError"));
                            }
                        });
                    }
                }
            });
        }
    });
});