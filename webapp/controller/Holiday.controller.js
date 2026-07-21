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
                MessageBox.error("Không lấy được dữ liệu ngày lễ.");
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
                MessageBox.error("Vui lòng chọn ngày lễ.", {
                    title: "Thiếu ngày lễ"
                });
                return;
            }

            if (!sHolDesc) {
                MessageBox.error("Mô tả ngày lễ không được để trống hoặc chỉ nhập dấu cách.", {
                    title: "Thiếu mô tả"
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
                        MessageToast.show("Cập nhật ngày lễ thành công.");
                        this.onCloseDialog();
                        oODataModel.refresh(true);
                    }.bind(this),
                    error: function (oError) {
                        sap.ui.core.BusyIndicator.hide();
                        console.error("Lỗi update /Holiday:", oError);
                        MessageBox.error(
                            this._getODataErrorMessage(oError, "Lỗi cập nhật ngày lễ."),
                            {
                                title: "Không thể cập nhật ngày lễ"
                            }
                        );
                    }.bind(this)
                });

                return;
            }

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
                    MessageBox.error(
                        this._getODataErrorMessage(
                            oError,
                            "Lỗi thêm ngày lễ. Kiểm tra ngày lễ có bị trùng không."
                        ),
                        {
                            title: "Không thể thêm ngày lễ"
                        }
                    );
                }.bind(this)
            });
        },

        onDeleteHoliday: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();

            if (!oContext) {
                MessageBox.error("Không lấy được dòng cần xóa.");
                return;
            }

            var oData = oContext.getObject();
            var oODataModel = this.getView().getModel();

            var sPath = this._buildHolidayPath(
                oODataModel,
                oData.HolDate
            );

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
                                MessageBox.error(
                                    this._getODataErrorMessage(oError, "Lỗi khi xóa ngày lễ."),
                                    {
                                        title: "Không thể xóa ngày lễ"
                                    }
                                );
                            }.bind(this)
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

            return dDate.toLocaleDateString("vi-VN", {
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
         * Quan trọng:
         * Gửi date dạng UTC 00:00 để OData không convert lùi 1 ngày ở GMT+7.
         * Ví dụ chọn 21/07/2026 sẽ gửi datetime'2026-07-21T00:00:00'
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

            return sDefaultMessage || "Có lỗi xảy ra.";
        }

    });
});