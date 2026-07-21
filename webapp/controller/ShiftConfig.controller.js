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
            var oODataModel = this.getOwnerComponent().getModel();

            if (oODataModel && oODataModel.setUseBatch) {
                oODataModel.setUseBatch(false);
            }

            this.getView().setModel(
                new JSONModel(this._getDefaultShiftData()),
                "shiftModel"
            );
        },

        _getDefaultShiftData: function () {
            return {
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
            var oODataModel = this.getView().getModel();
            var oShiftModel = this.getView().getModel("shiftModel");

            oShiftModel.setData({
                ShiftId: oData.ShiftId || "",
                StdHours: oData.StdHours !== undefined && oData.StdHours !== null ? String(oData.StdHours) : "8",
                TimeIn: this._edmTimeToHHmmss(oData.TimeIn),
                TimeOut: this._edmTimeToHHmmss(oData.TimeOut),
                NextDay: oData.NextDay,
                NextDayBool: this._isNextDayTrue(oData.NextDay),
                GraceMins: oData.GraceMins !== undefined && oData.GraceMins !== null ? String(oData.GraceMins) : "0",
                isEdit: true,
                sPath: this._buildSchedulePath(oODataModel, oData.ShiftId)
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
            var oShiftModel = this.getView().getModel("shiftModel");
            var oShiftData = oShiftModel.getData();

            var sShiftId = String(oShiftData.ShiftId || "").trim().toUpperCase();
            var sStdHours = String(oShiftData.StdHours || "").trim();
            var sGraceMins = String(oShiftData.GraceMins || "0").trim();

            if (!sShiftId) {
                MessageBox.error("Mã ca không được để trống hoặc chỉ nhập dấu cách.", {
                    title: "Thiếu mã ca"
                });
                return;
            }

            if (!/^[A-Z0-9_]+$/.test(sShiftId)) {
                MessageBox.error("Mã ca chỉ được dùng chữ, số và dấu gạch dưới. Ví dụ: CA_01, CA_02, TEST.", {
                    title: "Mã ca không hợp lệ"
                });
                return;
            }

            if (sShiftId.length > 20) {
                MessageBox.error("Mã ca không được vượt quá 20 ký tự.", {
                    title: "Mã ca quá dài"
                });
                return;
            }

            if (!sStdHours) {
                MessageBox.error("Giờ chuẩn không được để trống.", {
                    title: "Thiếu giờ chuẩn"
                });
                return;
            }

            var iStdHours = parseInt(sStdHours, 10);

            if (isNaN(iStdHours) || iStdHours <= 0 || iStdHours > 24) {
                MessageBox.error("Giờ chuẩn phải là số nguyên từ 1 đến 24.", {
                    title: "Giờ chuẩn không hợp lệ"
                });
                return;
            }

            var sTimeIn = this._normalizeHHmmss(oShiftData.TimeIn);
            var sTimeOut = this._normalizeHHmmss(oShiftData.TimeOut);

            if (!sTimeIn || !sTimeOut) {
                MessageBox.error("Vui lòng chọn Giờ bắt đầu và Giờ kết thúc hợp lệ.", {
                    title: "Thiếu giờ làm việc"
                });
                return;
            }

            if (!this._isValidHHmmss(sTimeIn) || !this._isValidHHmmss(sTimeOut)) {
                MessageBox.error("Giờ bắt đầu hoặc giờ kết thúc không hợp lệ.", {
                    title: "Giờ làm việc không hợp lệ"
                });
                return;
            }

            if (!oShiftData.NextDayBool && this._timeToSeconds(sTimeOut) <= this._timeToSeconds(sTimeIn)) {
                MessageBox.error("Giờ kết thúc phải lớn hơn giờ bắt đầu. Nếu ca qua ngày, hãy bật Ca qua ngày.", {
                    title: "Sai khung giờ"
                });
                return;
            }

            var iGraceMins = parseInt(sGraceMins || "0", 10);

            if (isNaN(iGraceMins) || iGraceMins < 0 || iGraceMins > 1440) {
                MessageBox.error("Grace mins phải là số nguyên từ 0 đến 1440.", {
                    title: "Grace mins không hợp lệ"
                });
                return;
            }

            oShiftModel.setProperty("/ShiftId", sShiftId);
            oShiftModel.setProperty("/StdHours", String(iStdHours));
            oShiftModel.setProperty("/TimeIn", sTimeIn);
            oShiftModel.setProperty("/TimeOut", sTimeOut);
            oShiftModel.setProperty("/GraceMins", String(iGraceMins));

            var vNextDayPayload = this._toNextDayPayload(oShiftData.NextDayBool);

            var oPayloadCreate = {
                ShiftId: sShiftId,
                StdHours: String(iStdHours),
                TimeIn: this._hhmmssToEdmTime(sTimeIn),
                TimeOut: this._hhmmssToEdmTime(sTimeOut),
                NextDay: vNextDayPayload,
                GraceMins: iGraceMins
            };

            var oPayloadUpdate = {
                StdHours: String(iStdHours),
                TimeIn: this._hhmmssToEdmTime(sTimeIn),
                TimeOut: this._hhmmssToEdmTime(sTimeOut),
                NextDay: vNextDayPayload,
                GraceMins: iGraceMins
            };

            sap.ui.core.BusyIndicator.show(0);

            if (oShiftData.isEdit) {
                this._updateShift(oODataModel, oShiftData, oPayloadUpdate);
                return;
            }

            this._createShift(oODataModel, oPayloadCreate);
        },

        _createShift: function (oODataModel, oPayloadCreate) {
            this._scheduleExists(oODataModel, oPayloadCreate.ShiftId).then(function (bExists) {
                if (bExists) {
                    sap.ui.core.BusyIndicator.hide();

                    MessageBox.error("Mã ca " + oPayloadCreate.ShiftId + " đã tồn tại. Vui lòng dùng mã ca khác.", {
                        title: "Trùng mã ca"
                    });

                    return;
                }

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
                        MessageBox.error(
                            this._getODataErrorMessage(
                                oError,
                                "Lỗi tạo mới ca. Kiểm tra mã ca có bị trùng hoặc dữ liệu không hợp lệ."
                            ),
                            {
                                title: "Không thể tạo ca làm việc"
                            }
                        );
                    }.bind(this)
                });
            }.bind(this)).catch(function (oError) {
                sap.ui.core.BusyIndicator.hide();
                console.error("Lỗi kiểm tra ca tồn tại:", oError);

                MessageBox.error(
                    this._getODataErrorMessage(oError, "Không thể kiểm tra mã ca trước khi tạo."),
                    {
                        title: "Không thể kiểm tra mã ca"
                    }
                );
            }.bind(this));
        },

        _updateShift: function (oODataModel, oShiftData, oPayloadUpdate) {
            var sPath = oShiftData.sPath || this._buildSchedulePath(oODataModel, oShiftData.ShiftId);

            oODataModel.update(sPath, oPayloadUpdate, {
                success: function () {
                    sap.ui.core.BusyIndicator.hide();
                    MessageToast.show("Cập nhật ca làm việc thành công.");
                    this.onCloseDialog();
                    oODataModel.refresh(true);
                }.bind(this),
                error: function (oError) {
                    sap.ui.core.BusyIndicator.hide();
                    console.error("Lỗi cập nhật /Schedule:", oError);
                    MessageBox.error(
                        this._getODataErrorMessage(oError, "Lỗi cập nhật ca làm việc."),
                        {
                            title: "Không thể cập nhật ca làm việc"
                        }
                    );
                }.bind(this)
            });
        },

        onDeleteShift: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();

            if (!oContext) {
                MessageBox.error("Không lấy được dòng cần xóa.");
                return;
            }

            var oData = oContext.getObject();
            var oODataModel = this.getView().getModel();
            var sPath = this._buildSchedulePath(oODataModel, oData.ShiftId);

            MessageBox.confirm(
                "Bạn có chắc muốn xóa ca " + oData.ShiftId + " không?",
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
                                MessageBox.error(
                                    this._getODataErrorMessage(oError, "Lỗi khi xóa ca làm việc."),
                                    {
                                        title: "Không thể xóa ca làm việc"
                                    }
                                );
                            }.bind(this)
                        });
                    }.bind(this)
                }
            );
        },

        formatODataTime: function (vTime) {
            return this._formatTimeFromHHmmss(this._edmTimeToHHmmss(vTime));
        },

        formatNextDayText: function (vNextDay) {
            return this._isNextDayTrue(vNextDay) ? "Có" : "Không";
        },

        formatNextDayState: function (vNextDay) {
            return this._isNextDayTrue(vNextDay) ? "Warning" : "Success";
        },

        _scheduleExists: function (oODataModel, sShiftId) {
            var sPath = this._buildSchedulePath(oODataModel, sShiftId);

            return new Promise(function (resolve, reject) {
                oODataModel.read(sPath, {
                    success: function () {
                        resolve(true);
                    },
                    error: function (oError) {
                        var iStatusCode = Number(oError && oError.statusCode);

                        if (iStatusCode === 404) {
                            resolve(false);
                            return;
                        }

                        reject(oError);
                    }
                });
            });
        },

        _buildSchedulePath: function (oODataModel, sShiftId) {
            return oODataModel.createKey("/Schedule", {
                ShiftId: String(sShiftId || "").trim().toUpperCase()
            });
        },

        _toNextDayPayload: function (bNextDay) {
            if (this._isSchedulePropertyBoolean("NextDay")) {
                return !!bNextDay;
            }

            return bNextDay ? "X" : "";
        },

        _isNextDayTrue: function (vNextDay) {
            if (vNextDay === true) {
                return true;
            }

            var sValue = String(vNextDay || "").trim().toUpperCase();

            return sValue === "X" || sValue === "TRUE" || sValue === "1";
        },

        _isSchedulePropertyBoolean: function (sPropertyName) {
            var oProperty = this._getScheduleProperty(sPropertyName);

            if (!oProperty) {
                return false;
            }

            return oProperty.type === "Edm.Boolean";
        },

        _getScheduleProperty: function (sPropertyName) {
            var oEntityType = this._getScheduleEntityType();

            if (!oEntityType || !oEntityType.property) {
                return null;
            }

            for (var i = 0; i < oEntityType.property.length; i++) {
                if (oEntityType.property[i].name === sPropertyName) {
                    return oEntityType.property[i];
                }
            }

            return null;
        },

        _getScheduleEntityType: function () {
            var oODataModel = this.getView().getModel();

            if (!oODataModel || !oODataModel.getServiceMetadata) {
                return null;
            }

            var oMetadata = oODataModel.getServiceMetadata();

            if (!oMetadata || !oMetadata.dataServices || !oMetadata.dataServices.schema) {
                return null;
            }

            var aSchemas = oMetadata.dataServices.schema;
            var sEntityTypeFullName = "";

            aSchemas.some(function (oSchema) {
                var oContainer = oSchema.entityContainer && oSchema.entityContainer[0];

                if (!oContainer || !oContainer.entitySet) {
                    return false;
                }

                return oContainer.entitySet.some(function (oEntitySet) {
                    if (oEntitySet.name === "Schedule") {
                        sEntityTypeFullName = oEntitySet.entityType;
                        return true;
                    }

                    return false;
                });
            });

            if (!sEntityTypeFullName) {
                return null;
            }

            var aParts = sEntityTypeFullName.split(".");
            var sTypeName = aParts.pop();
            var sNamespace = aParts.join(".");

            for (var i = 0; i < aSchemas.length; i++) {
                var oSchema = aSchemas[i];

                if (oSchema.namespace !== sNamespace || !oSchema.entityType) {
                    continue;
                }

                for (var j = 0; j < oSchema.entityType.length; j++) {
                    if (oSchema.entityType[j].name === sTypeName) {
                        return oSchema.entityType[j];
                    }
                }
            }

            return null;
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

            var sTime = String(vTime).trim();

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

            var sNormalized = this._normalizeHHmmss(sTime);

            return sNormalized || "000000";
        },

        _hhmmssToEdmTime: function (sHHMMSS) {
            var sTime = this._normalizeHHmmss(sHHMMSS);

            if (!sTime) {
                sTime = "000000";
            }

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
                return "";
            }

            sTime = String(sTime).trim();

            if (/^\d{6}$/.test(sTime)) {
                return sTime;
            }

            if (/^\d{2}:\d{2}:\d{2}$/.test(sTime)) {
                return sTime.substring(0, 2) + sTime.substring(3, 5) + sTime.substring(6, 8);
            }

            if (/^\d{2}:\d{2}$/.test(sTime)) {
                return sTime.substring(0, 2) + sTime.substring(3, 5) + "00";
            }

            return "";
        },

        _isValidHHmmss: function (sHHMMSS) {
            if (!/^\d{6}$/.test(sHHMMSS)) {
                return false;
            }

            var iHours = parseInt(sHHMMSS.substring(0, 2), 10);
            var iMinutes = parseInt(sHHMMSS.substring(2, 4), 10);
            var iSeconds = parseInt(sHHMMSS.substring(4, 6), 10);

            return iHours >= 0 && iHours <= 23 &&
                iMinutes >= 0 && iMinutes <= 59 &&
                iSeconds >= 0 && iSeconds <= 59;
        },

        _timeToSeconds: function (sHHMMSS) {
            return parseInt(sHHMMSS.substring(0, 2), 10) * 3600 +
                parseInt(sHHMMSS.substring(2, 4), 10) * 60 +
                parseInt(sHHMMSS.substring(4, 6), 10);
        },

        _formatTimeFromHHmmss: function (sHHMMSS) {
            var sTime = this._normalizeHHmmss(sHHMMSS);

            if (!sTime) {
                return "";
            }

            return sTime.substring(0, 2) + ":" + sTime.substring(2, 4);
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