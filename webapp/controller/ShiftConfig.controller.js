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
            this.getView().setModel(new JSONModel(this._getDefaultShiftData()), "shiftModel");
        },

        _getDefaultShiftData: function () {
            return {
                Plant: "1000",
                ShiftId: "",
                StdHours: "8",
                TimeIn: "070000",
                TimeOut: "150000",
                NextDay: "",
                NextDayBool: false,
                GraceMins: "0",
                isEdit: false,
                sPath: ""
            };
        },

        onOpenAddDialog: function () {
            var oShiftModel = this.getView().getModel("shiftModel");
            oShiftModel.setData(this._getDefaultShiftData());
            this._openDialog();
        },

        onEditShift: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();

            if (!oContext) {
                MessageBox.error("Không lấy được dữ liệu ca làm việc.");
                return;
            }

            var oData = oContext.getObject();
            var sPath = oContext.getPath();
            var oShiftModel = this.getView().getModel("shiftModel");

            oShiftModel.setData({
                Plant: oData.Plant,
                ShiftId: oData.ShiftId,
                StdHours: oData.StdHours ? String(oData.StdHours) : "8",
                TimeIn: this._edmTimeToHHmmss(oData.TimeIn),
                TimeOut: this._edmTimeToHHmmss(oData.TimeOut),
                NextDay: oData.NextDay || "",
                NextDayBool: oData.NextDay === "X",
                GraceMins: oData.GraceMins !== undefined && oData.GraceMins !== null ? String(oData.GraceMins) : "0",
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
                    name: "com.app.zu26g13.app.view.AddShiftDialog",
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

        onSaveShift: function () {
            var oODataModel = this.getView().getModel();
            var oShiftData = this.getView().getModel("shiftModel").getData();

            if (!oShiftData.Plant || !oShiftData.ShiftId) {
                MessageBox.error("Vui lòng nhập Nhà máy và Mã ca.");
                return;
            }

            if (!oShiftData.StdHours) {
                MessageBox.error("Vui lòng nhập Giờ chuẩn.");
                return;
            }

            if (!oShiftData.TimeIn || !oShiftData.TimeOut) {
                MessageBox.error("Vui lòng chọn Giờ bắt đầu và Giờ kết thúc.");
                return;
            }

            var iGraceMins = parseInt(oShiftData.GraceMins || "0", 10);

            if (isNaN(iGraceMins) || iGraceMins < 0) {
                MessageBox.error("Grace mins không hợp lệ.");
                return;
            }

            var oPayloadCreate = {
                Plant: oShiftData.Plant,
                ShiftId: oShiftData.ShiftId,
                StdHours: String(oShiftData.StdHours),
                TimeIn: this._hhmmssToEdmTime(oShiftData.TimeIn),
                TimeOut: this._hhmmssToEdmTime(oShiftData.TimeOut),
                NextDay: oShiftData.NextDayBool ? "X" : "",
                GraceMins: iGraceMins
            };

            var oPayloadUpdate = {
                StdHours: String(oShiftData.StdHours),
                TimeIn: this._hhmmssToEdmTime(oShiftData.TimeIn),
                TimeOut: this._hhmmssToEdmTime(oShiftData.TimeOut),
                NextDay: oShiftData.NextDayBool,
                GraceMins: iGraceMins
            };

            sap.ui.core.BusyIndicator.show(0);

            if (oShiftData.isEdit) {
                oODataModel.update(oShiftData.sPath, oPayloadUpdate, {
                    success: function () {
                        sap.ui.core.BusyIndicator.hide();
                        MessageToast.show("Cập nhật ca làm việc thành công.");
                        this.onCloseDialog();
                        oODataModel.refresh(true);
                    }.bind(this),
                    error: function (oError) {
                        sap.ui.core.BusyIndicator.hide();
                        console.error("Lỗi cập nhật /Schedule:", oError);
                        MessageBox.error("Lỗi cập nhật ca làm việc.");
                    }
                });
            } else {
                oODataModel.create("/Schedule", oPayloadCreate, {
                    success: function () {
                        sap.ui.core.BusyIndicator.hide();
                        MessageToast.show("Tạo ca làm việc thành công.");
                        this.onCloseDialog();
                        oODataModel.refresh(true);
                    }.bind(this),
                    error: function (oError) {
                        sap.ui.core.BusyIndicator.hide();
                        console.error("Lỗi tạo mới /Schedule:", oError);
                        MessageBox.error("Lỗi tạo mới ca. Kiểm tra mã ca có bị trùng không.");
                    }
                });
            }
        },

        onDeleteShift: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();

            if (!oContext) {
                MessageBox.error("Không lấy được dòng cần xóa.");
                return;
            }

            var sPath = oContext.getPath();
            var oData = oContext.getObject();
            var oODataModel = this.getView().getModel();

            MessageBox.confirm(
                "Bạn có chắc muốn xóa ca " + oData.ShiftId + " của nhà máy " + oData.Plant + " không?",
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
                                MessageToast.show("Xóa ca làm việc thành công.");
                                oODataModel.refresh(true);
                            },
                            error: function (oError) {
                                sap.ui.core.BusyIndicator.hide();
                                console.error("Lỗi xóa /Schedule:", oError);
                                MessageBox.error("Lỗi khi xóa ca làm việc.");
                            }
                        });
                    }
                }
            );
        },

        formatODataTime: function (vTime) {
            return this._formatTimeFromHHmmss(this._edmTimeToHHmmss(vTime));
        },

        formatNextDayText: function (sNextDay) {
            return sNextDay === "X" ? "Có" : "Không";
        },

        formatNextDayState: function (sNextDay) {
            return sNextDay === "X" ? "Warning" : "Success";
        },

        _edmTimeToHHmmss: function (vTime) {
            if (!vTime) {
                return "000000";
            }

            if (typeof vTime === "object" && vTime.ms !== undefined) {
                var iTotalSeconds = Math.floor(vTime.ms / 1000);
                var iHours = Math.floor(iTotalSeconds / 3600);
                var iMinutes = Math.floor((iTotalSeconds % 3600) / 60);
                var iSeconds = iTotalSeconds % 60;

                return String(iHours).padStart(2, "0") +
                    String(iMinutes).padStart(2, "0") +
                    String(iSeconds).padStart(2, "0");
            }

            var sTime = String(vTime);

            var aMatch = sTime.match(/^PT(\d+)H(\d+)M(\d+)S$/);
            if (aMatch) {
                return String(aMatch[1]).padStart(2, "0") +
                    String(aMatch[2]).padStart(2, "0") +
                    String(aMatch[3]).padStart(2, "0");
            }

            aMatch = sTime.match(/^PT(\d+)H(\d+)M$/);
            if (aMatch) {
                return String(aMatch[1]).padStart(2, "0") +
                    String(aMatch[2]).padStart(2, "0") +
                    "00";
            }

            if (/^\d{6}$/.test(sTime)) {
                return sTime;
            }

            if (/^\d{2}:\d{2}:\d{2}$/.test(sTime)) {
                return sTime.substring(0, 2) + sTime.substring(3, 5) + sTime.substring(6, 8);
            }

            if (/^\d{2}:\d{2}$/.test(sTime)) {
                return sTime.substring(0, 2) + sTime.substring(3, 5) + "00";
            }

            return "000000";
        },

        _hhmmssToEdmTime: function (sHHMMSS) {
            var sTime = this._normalizeHHmmss(sHHMMSS);
            var iHours = parseInt(sTime.substring(0, 2), 10);
            var iMinutes = parseInt(sTime.substring(2, 4), 10);
            var iSeconds = parseInt(sTime.substring(4, 6), 10);

            return {
                __edmType: "Edm.Time",
                ms: ((iHours * 60 * 60) + (iMinutes * 60) + iSeconds) * 1000
            };
        },

        _normalizeHHmmss: function (sTime) {
            if (!sTime) {
                return "000000";
            }

            sTime = String(sTime);

            if (/^\d{6}$/.test(sTime)) {
                return sTime;
            }

            if (/^\d{2}:\d{2}:\d{2}$/.test(sTime)) {
                return sTime.substring(0, 2) + sTime.substring(3, 5) + sTime.substring(6, 8);
            }

            if (/^\d{2}:\d{2}$/.test(sTime)) {
                return sTime.substring(0, 2) + sTime.substring(3, 5) + "00";
            }

            return "000000";
        },

        _formatTimeFromHHmmss: function (sHHMMSS) {
            var sTime = this._normalizeHHmmss(sHHMMSS);

            return sTime.substring(0, 2) + ":" + sTime.substring(2, 4);
        }
    });
});