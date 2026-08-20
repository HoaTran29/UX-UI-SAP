sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment",
    "sap/m/MessageBox"
], function (Controller, Filter, FilterOperator, MessageToast, Fragment, MessageBox) {
    "use strict";

    return Controller.extend("com.app.zu26g13.app.controller.Timesheet", {
        
        onInit: function () {
            // bắt sự kiện chuyển trang
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("timesheet").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function () {
            // lấy ngày hôm nay gắn vào ô lọc ngày mặc định
            var oDatePicker = this.byId("fltDate");
            oDatePicker.setDateValue(new Date());
            this.onSearch();
        },

        _getI18nText: function (sKey) {
            return this.getView().getModel("i18n").getResourceBundle().getText(sKey);
        },

        // =========================================================
        // lọc dữ liệu (filtering) & điều hướng
        // =========================================================
        onSearch: function () {
            var aFilters = [];
            var oDate = this.byId("fltDate").getDateValue();
            var sEmp = this.byId("fltEmp").getValue();

            // ép ngày về chuẩn utc để backend nhận diện đúng
            if (oDate) {
                var y = oDate.getFullYear();
                var m = oDate.getMonth();
                var d = oDate.getDate();

                var dStart = new Date(Date.UTC(y, m, d, 0, 0, 0));
                var dEnd = new Date(Date.UTC(y, m, d, 23, 59, 59));

                aFilters.push(new Filter("WorkDate", FilterOperator.BT, dStart, dEnd));
            }

            if (sEmp) {
                aFilters.push(new Filter("Pernr", FilterOperator.EQ, sEmp));
            }

            this.byId("dailyTimesheetTable").getBinding("items").filter(aFilters);
        },

        onClear: function () {
            this.byId("fltDate").setDateValue(new Date());
            this.byId("fltEmp").setValue("");
            this.onSearch();
        },

        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("dashboard");
        },

        // =========================================================
        // chỉnh sửa timesheet (edit dialog)
        // =========================================================
        onEditTimesheet: function (oEvent) {
            var oView = this.getView();
            var oContext = oEvent.getSource().getBindingContext();

            // tạo bản sao (deep copy) dữ liệu để không làm cập nhậtlên bảng ở ngoài khi chưa lưu
            var oRowData = JSON.parse(JSON.stringify(oContext.getObject()));
            var oDialogModel = new sap.ui.model.json.JSONModel(oRowData);

            if (!this._pEditDialog) {
                this._pEditDialog = Fragment.load({
                    id: oView.getId(),
                    name: "com.app.zu26g13.app.view.EditTimesheetDialog",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }

            this._pEditDialog.then(function (oDialog) {
                oDialog.setModel(oDialogModel);
                oDialog.bindElement("/");
                oDialog.data("originalPath", oContext.getPath());
                oDialog.open();
            });
        },

        onSaveTimesheet: function () {
            var oView = this.getView();
            var oODataModel = oView.getModel();
            var oDialog = this.byId("editTimesheetDialog");

            var oData = oDialog.getModel().getData();
            var sPath = oDialog.data("originalPath");
            var oOriginalData = oODataModel.getProperty(sPath);

            // xử lý chuẩn hóa ngày giờ
            var dWorkDate = oData.WorkDate;
            if (typeof dWorkDate === "string" && dWorkDate.indexOf("/Date(") === 0) {
                var iTime = parseInt(dWorkDate.replace(/\D/g, ""), 10);
                dWorkDate = new Date(iTime);
            } else if (!(dWorkDate instanceof Date)) {
                dWorkDate = new Date(dWorkDate);
            }
            var dODataWorkDate = new Date(Date.UTC(dWorkDate.getFullYear(), dWorkDate.getMonth(), dWorkDate.getDate(), 0, 0, 0));

            var dToday = new Date();
            dToday.setHours(0, 0, 0, 0);

            // hàm local bóc giây (seconds) từ định dạng giờ pt / ms
            var getSecondsFromTime = function (t) {
                if (!t) return 0;
                var h = 0, m = 0, s = 0;
                if (typeof t === "string") {
                    if (t.indexOf("PT") === 0) {
                        var aMatch = t.match(/PT(\d+)H(\d+)M(\d+)S/);
                        if (aMatch) {
                            h = parseInt(aMatch[1]);
                            m = parseInt(aMatch[2]);
                            s = parseInt(aMatch[3]);
                        }
                    } else {
                        var aParts = t.split(":");
                        if (aParts.length >= 2) {
                            h = parseInt(aParts[0]);
                            m = parseInt(aParts[1]);
                            s = aParts[2] ? parseInt(aParts[2]) : 0;
                        }
                    }
                } else if (t.ms !== undefined) {
                    return Math.floor(t.ms / 1000);
                }
                return h * 3600 + m * 60 + s;
            };

            var iNewInSec = getSecondsFromTime(oData.ActIn);
            var iNewOutSec = getSecondsFromTime(oData.ActOut);
            var iOldInSec = oOriginalData ? getSecondsFromTime(oOriginalData.ActIn) : 0;
            var iOldOutSec = oOriginalData ? getSecondsFromTime(oOriginalData.ActOut) : 0;

            // --- chặn lỗi ---
            if (iNewInSec === 0) {
                MessageBox.error(this._getI18nText("msgMissingCheckIn"));
                return;
            }
            // chặn bấm check out tay nếu ca của hôm nay chưa kết thúc
            if (dWorkDate.getTime() === dToday.getTime() && iOldOutSec === 0 && iNewOutSec > 0) {
                MessageBox.error(this._getI18nText("msgShiftOngoing"));
                return;
            }
            // không cho sửa check in sớm hơn thực tế quét thẻ
            if (iOldInSec > 0 && iNewInSec < iOldInSec) {
                MessageBox.error(this._getI18nText("msgEarlyCheckIn"));
                return;
            }
            // không cho sửa check out trễ hơn thực tế (chặn gian lận ot)
            if (iOldOutSec > 0 && iNewOutSec > iOldOutSec) {
                MessageBox.error(this._getI18nText("msgLateCheckOut"));
                return;
            }
            
            // chặn logic hỏng (in out trùng giờ hoặc làm quá 16 tiếng)
            if (iNewInSec > 0 && iNewOutSec > 0) {
                var iDiff = iNewOutSec - iNewInSec;
                if (iDiff < 0) iDiff += 24 * 3600; // xử lý ca qua đêm
                if (iDiff === 0) {
                    MessageBox.error(this._getI18nText("msgIdenticalTimes"));
                    return;
                }
                if (iDiff > 16 * 3600) {
                    MessageBox.error(this._getI18nText("msgExceed16Hours"));
                    return;
                }
            }

            var formatToODataTime = function (sTime) {
                if (!sTime) return null;
                return { ms: getSecondsFromTime(sTime) * 1000, __edmType: "Edm.Time" };
            };

            var sSeqNo = oData.SeqNo || (oOriginalData ? oOriginalData.SeqNo : "01");
            var sShiftId = oData.ShiftId || (oOriginalData ? oOriginalData.ShiftId : "");

            var oPayload = {
                SeqNo: sSeqNo,
                Pernr: oData.Pernr,
                WorkDate: dODataWorkDate,
                ShiftId: sShiftId,
                DeptId: oData.DeptId || "",
                ActIn: formatToODataTime(oData.ActIn),
                ActOut: formatToODataTime(oData.ActOut),
                WorkHours: oData.WorkHours ? parseFloat(oData.WorkHours).toString() : "0.00",
                OtHours: oData.OtHours ? parseFloat(oData.OtHours).toString() : "0.00",
                Status: oData.Status || "COMPLETED"
            };

            var sNewPath = oODataModel.createKey("/Timesheet", {
                SeqNo: sSeqNo,
                Pernr: oData.Pernr,
                WorkDate: dODataWorkDate,
                ShiftId: sShiftId
            });

            oDialog.setBusy(true);

            oODataModel.update(sNewPath, oPayload, {
                success: function () {
                    oDialog.setBusy(false);
                    MessageToast.show(this._getI18nText("msgTimesheetUpdated"));
                    oDialog.close();
                    oODataModel.refresh(true);
                }.bind(this),
                error: function (oError) {
                    oDialog.setBusy(false);
                    var sErrorMsg = this._getI18nText("msgUpdateTimesheetError");
                    try {
                        var oResponseBody = JSON.parse(oError.responseText);
                        if (oResponseBody && oResponseBody.error && oResponseBody.error.message) {
                            sErrorMsg = oResponseBody.error.message.value;
                        }
                    } catch (e) {}
                    MessageBox.error(sErrorMsg);
                }.bind(this)
            });
        },

        onCancelTimesheet: function () {
            var oDialog = this.byId("editTimesheetDialog");
            if (oDialog) oDialog.close();
        },

        // =========================================================
        // định dạng hiển thị (formatters)
        // =========================================================
        formatStatusText: function (sStatus, dWorkDate) {
            return sStatus || "";
        },

        formatStatusState: function (sStatus, dWorkDate) {
            if (!dWorkDate) return "None";

            var oToday = new Date(); oToday.setHours(0, 0, 0, 0);
            var oWork = new Date(dWorkDate); oWork.setHours(0, 0, 0, 0);

            // ngày tương lai thì không tô màu
            if (oWork > oToday) return "None";

            if (sStatus === "ABSENT") return "Warning"; 
            if (sStatus === "COMPLETED") return "Success"; 
            if (sStatus === "WARNING") return "Error"; 
            if (sStatus === "LEAVE") return "Information"; 
            return "None";
        },

        formatTimeDisplay: function (oTime, dWorkDate) {
            var oToday = new Date(); oToday.setHours(0, 0, 0, 0);
            var oWork = new Date(dWorkDate); oWork.setHours(0, 0, 0, 0);

            // hiển thị 00:00:00 cho ngày tương lai hoặc giờ trống
            if (oWork > oToday || !oTime || oTime.ms === 0 || oTime === "PT00H00M00S") {
                return "00:00:00";
            }

            var timeFormat = sap.ui.core.format.DateFormat.getTimeInstance({ pattern: "HH:mm:ss", UTC: true });
            return timeFormat.format(new Date(oTime.ms));
        },

        // ==========================================================
        // popup chọn nhân viên (employee value help)
        // ==========================================================
        onEmployeeValueHelpRequest: function (oEvent) {
            var oView = this.getView();
            this._oInputEmp = oEvent.getSource();

            if (!this._pEmpValueHelpDialog) {
                this._pEmpValueHelpDialog = Fragment.load({
                    id: oView.getId(),
                    name: "com.app.zu26g13.app.view.EmployeeValueHelp",
                    controller: this
                }).then(function (oPopover) {
                    oView.addDependent(oPopover);
                    return oPopover;
                });
            }
            this._pEmpValueHelpDialog.then(function (oPopover) {
                var oList = this.byId("empValueHelpList");
                if (oList) oList.getBinding("items").filter([]);
                oPopover.openBy(this._oInputEmp);
            }.bind(this));
        },

        onEmployeeValueHelpSearch: function (oEvent) {
            var sValue = oEvent.getParameter("value") || oEvent.getParameter("newValue");
            var oFilterName = new Filter("Ename", FilterOperator.Contains, sValue);
            var oFilterId = new Filter("Pernr", FilterOperator.EQ, sValue);
            
            this.byId("empValueHelpList").getBinding("items").filter([new Filter({ filters: [oFilterName, oFilterId], and: false })]);
        },

        onEmployeeValueHelpConfirm: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("listItem");
            if (oSelectedItem) {
                this._oInputEmp.setValue(oSelectedItem.getDescription());
                if (this.onSearch) this.onSearch();
            }
            if (this._pEmpValueHelpDialog) {
                this._pEmpValueHelpDialog.then(function (oPopover) { oPopover.close(); });
            }
        },

        onEmployeeValueHelpCancel: function () {
            if (this._pEmpValueHelpDialog) {
                this._pEmpValueHelpDialog.then(function (oPopover) { oPopover.close(); });
            }
        },

        // =========================================================
        // log quét thẻ (punch log dialog)
        // =========================================================
        onOpenPunchLog: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            var oRowData = oContext.getObject();
            var oView = this.getView();

            if (!this._pPunchLogDialog) {
                this._pPunchLogDialog = Fragment.load({
                    id: oView.getId(),
                    name: "com.app.zu26g13.app.view.PunchLogDialog",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }

            this._pPunchLogDialog.then(function (oDialog) {
                oDialog.setBindingContext(oContext);

                var oBinding = this.byId("punchLogTable").getBinding("items");
                var aFilters = [
                    new Filter("Pernr", FilterOperator.EQ, oRowData.Pernr),
                    new Filter("ShiftId", FilterOperator.EQ, oRowData.ShiftId)
                ];

                // lấy punch log trong ngày
                if (oRowData.WorkDate) {
                    var dDate = new Date(oRowData.WorkDate);
                    var dODataDateStart = new Date(Date.UTC(dDate.getFullYear(), dDate.getMonth(), dDate.getDate(), 0, 0, 0));
                    var dODataDateEnd = new Date(Date.UTC(dDate.getFullYear(), dDate.getMonth(), dDate.getDate() + 1, 23, 59, 59));
                    aFilters.push(new Filter("PunchDate", FilterOperator.BT, dODataDateStart, dODataDateEnd));
                }

                oBinding.filter(aFilters);
                oDialog.open();
            }.bind(this));
        },

        onClosePunchLogDialog: function () {
            if (this._pPunchLogDialog) {
                this._pPunchLogDialog.then(function (oDialog) { oDialog.close(); });
            }
        }
    });
});