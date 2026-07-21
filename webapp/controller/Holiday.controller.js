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
            this.getView().setModel(new JSONModel(this._getDefaultHolidayData()), "holidayModel");
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
                MessageBox.error("Không lấy được dữ liệu ngày lễ.");
                return;
            }

            var oData = oContext.getObject();
            var sPath = oContext.getPath();

            this.getView().getModel("holidayModel").setData({
                HolDate: this._toDate(oData.HolDate),
                HolDesc: oData.HolDesc || "",
                isEdit: true,
                sPath: sPath
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
            var oHolidayData = this.getView().getModel("holidayModel").getData();

            if (!oHolidayData.HolDate || !oHolidayData.HolDesc) {
                MessageBox.error("Vui lòng nhập đầy đủ Ngày lễ và Mô tả.");
                return;
            }

            var oPayloadCreate = {
                HolDate: this._normalizeDate(oHolidayData.HolDate),
                HolDesc: oHolidayData.HolDesc
            };

            var oPayloadUpdate = {
                HolDesc: oHolidayData.HolDesc
            };

            sap.ui.core.BusyIndicator.show(0);

            if (oHolidayData.isEdit) {
                oODataModel.update(oHolidayData.sPath, oPayloadUpdate, {
                    success: function () {
                        sap.ui.core.BusyIndicator.hide();
                        MessageToast.show("Cập nhật ngày lễ thành công.");
                        this.onCloseDialog();
                        oODataModel.refresh(true);
                    }.bind(this),
                    error: function (oError) {
                        sap.ui.core.BusyIndicator.hide();
                        console.error("Lỗi update /Holiday:", oError);
                        MessageBox.error("Lỗi cập nhật ngày lễ.");
                    }
                });
            } else {
                oODataModel.create("/Holiday", oPayloadCreate, {
                    success: function () {
                        sap.ui.core.BusyIndicator.hide();
                        MessageToast.show("Thêm ngày lễ thành công.");
                        this.onCloseDialog();
                        oODataModel.refresh(true);
                    }.bind(this),
                    error: function (oError) {
                        sap.ui.core.BusyIndicator.hide();
                        console.error("Lỗi create /Holiday:", oError);
                        MessageBox.error("Lỗi thêm ngày lễ. Kiểm tra ngày lễ có bị trùng không.");
                    }
                });
            }
        },

        onDeleteHoliday: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();

            if (!oContext) {
                MessageBox.error("Không lấy được dòng cần xóa.");
                return;
            }

            var sPath = oContext.getPath();
            var oData = oContext.getObject();
            var oODataModel = this.getView().getModel();

            MessageBox.confirm(
                "Bạn có chắc muốn xóa ngày lễ " + this.formatDate(oData.HolDate) + " không?",
                {
                    title: "Xác nhận xóa",
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
                                MessageToast.show("Xóa ngày lễ thành công.");
                                oODataModel.refresh(true);
                            },
                            error: function (oError) {
                                sap.ui.core.BusyIndicator.hide();
                                console.error("Lỗi delete /Holiday:", oError);
                                MessageBox.error("Lỗi khi xóa ngày lễ.");
                            }
                        });
                    }.bind(this)
                }
            );
        },

        formatDate: function (vDate) {
            var dDate = this._toDate(vDate);

            if (!dDate) {
                return "";
            }

            return dDate.toLocaleDateString("vi-VN");
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
            var dDate = new Date(vDate);
            dDate.setHours(0, 0, 0, 0);
            return dDate;
        }

    });
});