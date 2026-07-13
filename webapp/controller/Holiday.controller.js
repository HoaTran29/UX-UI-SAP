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

            /*
             * Tắt batch để thao tác create/update/delete ngày lễ chạy rõ ràng,
             * tránh lỗi gom request khi backend trả lỗi.
             */
            if (oODataModel && oODataModel.setUseBatch) {
                oODataModel.setUseBatch(false);
            }

            this.getView().setModel(new JSONModel(this._getDefaultHolidayData()), "holidayModel");
        },

        _getDefaultHolidayData: function () {
            return {
                Plant: "1000",
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

            this.getView().getModel("holidayModel").setData({
                Plant: oData.Plant,
                HolDate: this._toDate(oData.HolDate),
                HolDesc: oData.HolDesc || "",
                isEdit: true,
                sPath: this._buildHolidayPath(
                    this.getView().getModel(),
                    oData.Plant,
                    oData.HolDate
                )
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

            if (!oHolidayData.Plant || !oHolidayData.HolDate || !oHolidayData.HolDesc) {
                MessageBox.error("Vui lòng nhập đầy đủ Nhà máy, Ngày lễ và Mô tả.");
                return;
            }

            /*
             * Quan trọng:
             * Không dùng new Date().setHours(0,0,0,0) để gửi OData.
             * Dùng Date.UTC để tránh bị lùi 1 ngày do timezone Việt Nam GMT+7.
             */
            var dHolDateOData = this._toODataDate(oHolidayData.HolDate);

            var oPayloadCreate = {
                Plant: oHolidayData.Plant,
                HolDate: dHolDateOData,
                HolDesc: oHolidayData.HolDesc
            };

            var oPayloadUpdate = {
                HolDesc: oHolidayData.HolDesc
            };

            sap.ui.core.BusyIndicator.show(0);

            if (oHolidayData.isEdit) {
                var sUpdatePath = oHolidayData.sPath || this._buildHolidayPath(
                    oODataModel,
                    oHolidayData.Plant,
                    oHolidayData.HolDate
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

            var oData = oContext.getObject();
            var oODataModel = this.getView().getModel();

            var sPath = this._buildHolidayPath(
                oODataModel,
                oData.Plant,
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

            return dDate.toLocaleDateString("vi-VN", {
                timeZone: "Asia/Ho_Chi_Minh",
                day: "2-digit",
                month: "2-digit",
                year: "numeric"
            });
        },

        /*
         * Convert mọi kiểu ngày từ OData / DatePicker về Date object.
         */
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

        /*
         * Convert ngày để gửi lên OData.
         * Chống lỗi Việt Nam GMT+7 bị lùi về ngày hôm trước.
         */
        _toODataDate: function (vDate) {
            var dDate = this._toDate(vDate);

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

        /*
         * Tạo key chuẩn cho entity Holiday.
         * Dùng UTC date để không bị createKey sai ngày.
         */
        _buildHolidayPath: function (oODataModel, sPlant, vHolDate) {
            return oODataModel.createKey("/Holiday", {
                Plant: sPlant,
                HolDate: this._toODataDate(vHolDate)
            });
        }

    });
});