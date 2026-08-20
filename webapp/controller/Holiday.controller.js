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
            if (oODataModel && oODataModel.setUseBatch) oODataModel.setUseBatch(false);

            this.getView().setModel(new JSONModel(this._getDefaultHolidayData()), "holidayModel");
            this.getView().setModel(new JSONModel({ payTypes: [] }), "payTypeModel");
            
            this._loadPayTypes();
            // load lại bảng mỗi khi vào màn hình này
            this.getOwnerComponent().getRouter().getRoute("holiday").attachPatternMatched(this._reloadViewData, this);
        },

        _getI18nText: function (sKey, aArgs) {
            return this.getView().getModel("i18n").getResourceBundle().getText(sKey, aArgs);
        },

        _getDefaultHolidayData: function () {
            return { HolDate: new Date(), HolDesc: "", HolPayCode: "", isEdit: false, sPath: "" };
        },

        // đẩy event để app biết là data bị đổi
        _publishDataChanged: function (sAction) {
            sap.ui.getCore().getEventBus().publish("codesap", "DataChanged", {
                source: "Holiday", action: sAction || "refresh", timestamp: Date.now()
            });
        },

        // =========================================================
        // quản lý popup
        // =========================================================
        onOpenAddDialog: function () {
            var oDefaultData = this._getDefaultHolidayData();
            var aPayTypes = this.getView().getModel("payTypeModel").getProperty("/payTypes");
            if (aPayTypes && aPayTypes.length > 0) {
                oDefaultData.HolPayCode = aPayTypes[0].PayCode;
            }

            this.getView().getModel("holidayModel").setData(oDefaultData);
            this._openDialog();
        },

        onEditHoliday: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            if (!oContext) {
                MessageBox.error(this._getI18nText("msgErrorGetHolidayData"));
                return;
            }

            var oData = oContext.getObject();
            var aPayTypes = this.getView().getModel("payTypeModel").getProperty("/payTypes");
            var sDefaultPayCode = (aPayTypes && aPayTypes.length > 0) ? aPayTypes[0].PayCode : "";

            this.getView().getModel("holidayModel").setData({
                HolDate: this._toDate(oData.HolDate),
                HolDesc: oData.HolDesc || "",
                HolPayCode: oData.HolPayCode || sDefaultPayCode, 
                isEdit: true,
                sPath: this._buildHolidayPath(this.getView().getModel(), oData.HolDate)
            });

            this._openDialog();
        },

        _openDialog: function () {
            var oView = this.getView();
            if (!this.pDialog) {
                this.pDialog = Fragment.load({
                    id: oView.getId(), name: "com.app.zu26g13.app.view.AddHolidayDialog", controller: this
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
        onSaveHoliday: function () {
            var oODataModel = this.getView().getModel();
            var oHolidayModel = this.getView().getModel("holidayModel");
            var oHolidayData = oHolidayModel.getData();
            
            var sHolPayCode = String(oHolidayData.HolPayCode || "").trim();
            var dHolDate = this._toDate(oHolidayData.HolDate);
            var sHolDesc = String(oHolidayData.HolDesc || "").trim();

            // validate chặn
            if (!dHolDate) return MessageBox.error(this._getI18nText("msgSelectHolidayDate"), { title: this._getI18nText("titleMissingDate") });
            if (!sHolDesc) return MessageBox.error(this._getI18nText("msgMissingDesc"), { title: this._getI18nText("titleMissingDesc") });
            if (!sHolPayCode) return MessageBox.error(this._getI18nText("msgMissingPayCode"), { title: "Error" });

            oHolidayModel.setProperty("/HolDesc", sHolDesc);
            oHolidayModel.setProperty("/HolPayCode", sHolPayCode);

            var oPayload = {
                HolDate: this._toODataDate(dHolDate),
                HolDesc: sHolDesc,
                HolPayCode: sHolPayCode
            };

            sap.ui.core.BusyIndicator.show(0);

            if (oHolidayData.isEdit) {
                var sUpdatePath = oHolidayData.sPath || this._buildHolidayPath(oODataModel, dHolDate);
                oODataModel.update(sUpdatePath, { HolDesc: sHolDesc, HolPayCode: sHolPayCode }, {
                    success: function () {
                        sap.ui.core.BusyIndicator.hide();
                        MessageToast.show(this._getI18nText("msgHolidayUpdated"));
                        this.onCloseDialog();
                        this._publishDataChanged("update");
                        this._reloadViewData();
                    }.bind(this),
                    error: function (oError) {
                        sap.ui.core.BusyIndicator.hide();
                        MessageBox.error(this._getODataErrorMessage(oError, this._getI18nText("msgUpdateHolidayError")), { title: this._getI18nText("titleUpdateError") });
                    }.bind(this)
                });
            } else {
                oODataModel.create("/Holiday", oPayload, {
                    success: function () {
                        sap.ui.core.BusyIndicator.hide();
                        MessageToast.show(this._getI18nText("msgHolidayCreated"));
                        this.onCloseDialog();
                        this._publishDataChanged("create");
                        this._reloadViewData();
                    }.bind(this),
                    error: function (oError) {
                        sap.ui.core.BusyIndicator.hide();
                        MessageBox.error(this._getODataErrorMessage(oError, this._getI18nText("msgCreateHolidayError")), { title: this._getI18nText("titleCreateError") });
                    }.bind(this)
                });
            }
        },

        onDeleteHoliday: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            if (!oContext) return MessageBox.error(this._getI18nText("msgErrorGetDeleteRow"));

            var oData = oContext.getObject();
            var oODataModel = this.getView().getModel();
            var sPath = this._buildHolidayPath(oODataModel, oData.HolDate);

            MessageBox.confirm(this._getI18nText("msgConfirmDeleteHoliday", [this.formatDate(oData.HolDate)]), {
                title: this._getI18nText("titleConfirmDeleteHoliday"),
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                emphasizedAction: MessageBox.Action.OK,
                onClose: function (sAction) {
                    if (sAction !== MessageBox.Action.OK) return;

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
                            MessageBox.error(this._getODataErrorMessage(oError, this._getI18nText("msgDeleteHolidayError")), { title: this._getI18nText("titleDeleteError") });
                        }.bind(this)
                    });
                }.bind(this)
            });
        },

        // =========================================================
        // các hàm tiện ích (utilities)
        // =========================================================
        _reloadViewData: function () {
            var oODataModel = this.getView().getModel();
            var oTable = this.byId("holidayTable");
            
            if (oODataModel) {
                oODataModel.refresh(true);
                if (oODataModel.updateBindings) oODataModel.updateBindings(true);
            }
            if (oTable && oTable.getBinding("items")) oTable.getBinding("items").refresh(true);
        },

        formatDate: function (vDate) {
            var dDate = this._toDate(vDate);
            if (!dDate) return "";
            return dDate.toLocaleDateString("en-GB", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" });
        },

        _toDate: function (vDate) {
            if (!vDate) return null;
            if (vDate instanceof Date) return vDate;
            if (typeof vDate === "string" && vDate.indexOf("/Date(") === 0) return new Date(parseInt(vDate.replace(/\D/g, ""), 10));
            return new Date(vDate);
        },

        _toODataDate: function (vDate) {
            var dDate = this._toDate(vDate);
            if (!dDate) return null;
            return new Date(Date.UTC(dDate.getFullYear(), dDate.getMonth(), dDate.getDate(), 0, 0, 0));
        },

        _buildHolidayPath: function (oODataModel, vHolDate) {
            return oODataModel.createKey("/Holiday", { HolDate: this._toODataDate(vHolDate) });
        },

        // lấy lỗi từ backend odata
        _getODataErrorMessage: function (oError, sDefaultMessage) {
            try {
                if (oError && oError.responseText) {
                    var oBody = JSON.parse(oError.responseText);
                    if (oBody && oBody.error && oBody.error.message && oBody.error.message.value) {
                        return oBody.error.message.value;
                    }
                }
            } catch (e) {}
            return sDefaultMessage || this._getI18nText("msgUnexpectedError");
        },

        _loadPayTypes: function () {
            this.getOwnerComponent().getModel().read("/PayTypeConfig", {
                success: function (oData) {
                    this.getView().getModel("payTypeModel").setProperty("/payTypes", oData.results || []);
                }.bind(this)
            });
        }
    });
});