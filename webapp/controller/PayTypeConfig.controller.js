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
            // Create a local model to manage data on the Dialog (Pop-up)
            this.getView().setModel(new JSONModel({}), "localModel");
        },

        // Helper function to get i18n texts dynamically
        _getI18nText: function (sKey) {
            return this.getView().getModel("i18n").getResourceBundle().getText(sKey);
        },

        // ==========================================
        // 1. SEARCH & FILTER FUNCTIONALITY
        // ==========================================
        onSearch: function () {
            var aFilters = [];
            var sCode = this.byId("fltPayCode").getValue();
            var sCategory = this.byId("fltCategory").getValue();

            if (sCode) {
                aFilters.push(new Filter("PayCode", FilterOperator.Contains, sCode));
            }
            if (sCategory) {
                aFilters.push(new Filter("PayCategory", FilterOperator.EQ, sCategory));
            }

            var oTable = this.byId("payTypeTable");
            oTable.getBinding("items").filter(aFilters);
        },

        onClear: function () {
            this.byId("fltPayCode").setValue("");
            this.byId("fltCategory").setValue("");
            this.onSearch();
        },

        // ==========================================
        // 2. OPEN CREATE / EDIT DIALOG
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
            
            // Set empty data for the Create screen using i18n
            oLocalModel.setData({
                title: this._getI18nText("titleCreatePayRate"),
                isNew: true,
                PayCode: "",
                PayCategory: "ST",
                RateFactor: "1.0",
                PayDesc: "",
                IsNight: " ",
                DayType: "N"
            });
            this._openDialog();
        },

        onEditPress: function (oEvent) {
            var oItem = oEvent.getSource().getParent().getParent(); 
            var oData = oItem.getBindingContext().getObject();      
            
            var oLocalModel = this.getView().getModel("localModel");
            var sIsNightKey = (oData.IsNight === true || oData.IsNight === 'X') ? "X" : " ";
            
            // Load data into the Dialog for editing using i18n
            oLocalModel.setData({
                title: this._getI18nText("titleEditPayRate") + " " + oData.PayCode,
                isNew: false, 
                path: oItem.getBindingContext().getPath(),
                PayCode: oData.PayCode,
                PayCategory: oData.PayCategory,
                RateFactor: oData.RateFactor,
                PayDesc: oData.PayDesc,
                IsNight: sIsNightKey,
                DayType: oData.DayType
            });
            this._openDialog();
        },

        onCancelDialog: function () {
            this.byId("dlgPayType").close();
        },

        // ==========================================
        // 3. SAVE (CREATE / UPDATE) AND DELETE
        // ==========================================
        onSaveDialog: function () {
            var oModel = this.getView().getModel();
            var oLocalData = this.getView().getModel("localModel").getData();
            var that = this;
            var bIsNightPayload = (oLocalData.IsNight === "X" || oLocalData.IsNight === true);

            var oPayload = {
                PayCode: oLocalData.PayCode.toUpperCase(),
                PayCategory: oLocalData.PayCategory.toUpperCase(),
                RateFactor: oLocalData.RateFactor,
                PayDesc: oLocalData.PayDesc,
                IsNight: bIsNightPayload,
                DayType: oLocalData.DayType
            };

            if (oLocalData.isNew) {
                oModel.create("/PayTypeConfig", oPayload, {
                    success: function () {
                        MessageToast.show(that._getI18nText("msgCreatePayRateSuccess"));
                        that.onCancelDialog();
                    },
                    error: function (oError) {
                        MessageBox.error(that._getI18nText("msgCreatePayRateError"));
                    }
                });
            } else {
                oModel.update(oLocalData.path, oPayload, {
                    success: function () {
                        MessageToast.show(that._getI18nText("msgUpdatePayRateSuccess"));
                        that.onCancelDialog();
                    },
                    error: function (oError) {
                        MessageBox.error(that._getI18nText("msgUpdatePayRateError"));
                    }
                });
            }
        },

        onDeletePress: function (oEvent) {
            var oItem = oEvent.getSource().getParent().getParent();
            var sPath = oItem.getBindingContext().getPath();
            var oModel = this.getView().getModel();
            var that = this; // Store context for i18n access inside callbacks

            MessageBox.confirm(this._getI18nText("msgConfirmDeletePayRate"), {
                icon: MessageBox.Icon.WARNING,
                title: this._getI18nText("titleConfirmDelete"), // Using existing key from your i18n
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        oModel.remove(sPath, {
                            success: function () {
                                MessageToast.show(that._getI18nText("msgDeletePayRateSuccess"));
                            },
                            error: function () {
                                MessageBox.error(that._getI18nText("msgDeletePayRateError"));
                            }
                        });
                    }
                }
            });
        },
        formatNightShiftText: function (vIsNight) {
            if (vIsNight === true || vIsNight === "X" || vIsNight === "x") {
                return this._getI18nText("txtYes");
            }
            return this._getI18nText("txtNo");
        },

        formatNightShiftState: function (vIsNight) {
            if (vIsNight === true || vIsNight === "X" || vIsNight === "x") {
                return "Warning";
            }
            return "None";
        }
    });
});