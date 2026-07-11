sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Controller, MessageBox, Fragment, JSONModel, Filter, FilterOperator) {
    "use strict";

    return Controller.extend("com.app.zu26g13.app.controller.Schedule", {

        onInit: function () {
            var oODataModel = this.getOwnerComponent().getModel();

            /*
             * Tắt batch để tránh lỗi:
             * Another request in the same change set failed
             */
            if (oODataModel && oODataModel.setUseBatch) {
                oODataModel.setUseBatch(false);
            }

            this.getView().setModel(new JSONModel({
                employees: []
            }), "calendarModel");

            this.getView().setModel(new JSONModel({
                shifts: []
            }), "shiftLookupModel");

            this.getView().setModel(new JSONModel({
                employees: [],
                allEmployees: []
            }), "employeeLookupModel");

            this.getView().setModel(new JSONModel(this._getDefaultDialogData()), "dialogModel");

            this.getView().attachEventOnce("modelContextChange", function () {
                this._loadShiftLookup("1000");
                this._loadCalendarData();
            }, this);
        },

        _getDefaultDialogData: function () {
            return {
                Pernr: "",
                StartDate: new Date(),
                EndDate: new Date(),
                PlanDate: new Date(),
                ShiftId: "",
                OldShiftId: "",
                OtHours: "0.00",
                Plant: "1000",
                IsOt: false,
                isEdit: false,
                sEmpShiftPath: "",
                sOtPath: ""
            };
        },

        _loadShiftLookup: function (sPlantInput) {
            var oODataModel = this.getView().getModel();
            var oShiftLookupModel = this.getView().getModel("shiftLookupModel");
            var oDialogModel = this.getView().getModel("dialogModel");

            if (!oODataModel) {
                return;
            }

            var sPlant = sPlantInput || oDialogModel.getProperty("/Plant") || "1000";

            oODataModel.read("/ShiftLookup", {
                filters: [
                    new Filter("Plant", FilterOperator.EQ, sPlant)
                ],
                success: function (oData) {
                    var aShifts = (oData.results || []).map(function (item) {
                        return {
                            Plant: item.Plant,
                            ShiftId: item.ShiftId,
                            TimeIn: item.TimeIn,
                            TimeOut: item.TimeOut,
                            ShiftText: item.ShiftId + " - " +
                                this._formatTime(item.TimeIn) + " đến " +
                                this._formatTime(item.TimeOut)
                        };
                    }.bind(this));

                    oShiftLookupModel.setProperty("/shifts", aShifts);

                    if (!oDialogModel.getProperty("/ShiftId") && aShifts.length > 0) {
                        oDialogModel.setProperty("/ShiftId", aShifts[0].ShiftId);
                    }
                }.bind(this),
                error: function (oError) {
                    console.error("Lỗi đọc /ShiftLookup:", oError);
                    MessageBox.error("Không thể lấy danh sách ca làm việc từ bảng ZTA_SCHEDULE.");
                }
            });
        },

        _loadCalendarData: function () {
            var oCalendarModel = this.getView().getModel("calendarModel");
            var oODataModel = this.getView().getModel();

            sap.ui.core.BusyIndicator.show(0);

            this._readSet("/EmpShift").then(function (aEmpShift) {
                return this._readSet("/OtPlan").catch(function () {
                    return [];
                }).then(function (aOtPlan) {
                    sap.ui.core.BusyIndicator.hide();

                    var mOtByKey = {};

                    aOtPlan.forEach(function (ot) {
                        var sKey = ot.Pernr + "|" + this._dateKey(this._toDate(ot.PlanDate));
                        mOtByKey[sKey] = ot;
                    }.bind(this));

                    var oGrouped = {};

                    aEmpShift.forEach(function (item) {
                        var dWorkDate = this._toDate(item.WorkDate);
                        var sDateKey = this._dateKey(dWorkDate);
                        var sOtKey = item.Pernr + "|" + sDateKey;
                        var oOt = mOtByKey[sOtKey];

                        var dStartDate = new Date(dWorkDate);
                        dStartDate.setHours(0, 30, 0, 0);

                        var dEndDate = new Date(dWorkDate);
                        dEndDate.setHours(22, 30, 0, 0);

                        var sShiftTimeIn = this._formatTime(item.ShiftTimeIn);
                        var sShiftTimeOut = this._formatTime(item.ShiftTimeOut);
                        var sShiftTimeText = sShiftTimeIn + " - " + sShiftTimeOut;
                        var sOtHours = oOt ? String(oOt.OtHours || "0.00") : "0.00";

                        if (!oGrouped[item.Pernr]) {
                            oGrouped[item.Pernr] = {
                                Pernr: item.Pernr,
                                EmployeeName: item.EmployeeName || "Nhân viên chưa có tên",
                                Plant: oOt && oOt.Plant ? oOt.Plant : "1000",
                                appointments: []
                            };
                        }

                        var sEmpShiftPath = this._buildEmpShiftPath(
                            oODataModel,
                            item.Pernr,
                            dWorkDate,
                            item.ShiftId
                        );

                        var sOtPath = "";

                        if (oOt) {
                            sOtPath = oODataModel.createKey("/OtPlan", {
                                Pernr: oOt.Pernr,
                                PlanDate: this._toODataDate(this._toDate(oOt.PlanDate))
                            });
                        }

                        oGrouped[item.Pernr].appointments.push({
                            Pernr: item.Pernr,
                            EmployeeName: item.EmployeeName || "Nhân viên chưa có tên",
                            PlanDate: dWorkDate,
                            WorkDate: dWorkDate,
                            StartDate: dStartDate,
                            EndDate: dEndDate,

                            ShiftId: item.ShiftId,
                            OldShiftId: item.ShiftId,
                            OtHours: sOtHours,
                            Plant: oOt && oOt.Plant ? oOt.Plant : "1000",
                            IsOt: oOt ? oOt.IsOt : false,

                            AppointmentTitle: "Ca: " + item.ShiftId,
                            AppointmentText: "OT: " + sOtHours + "h",
                            AppointmentTooltip: "Ca: " + item.ShiftId +
                                " | Giờ: " + sShiftTimeText +
                                " | OT: " + sOtHours + "h",

                            sEmpShiftPath: sEmpShiftPath,
                            sOtPath: sOtPath
                        });
                    }.bind(this));

                    oCalendarModel.setProperty("/employees", Object.values(oGrouped));
                }.bind(this));
            }.bind(this)).catch(function (oError) {
                sap.ui.core.BusyIndicator.hide();
                console.error("Lỗi đọc /EmpShift:", oError);
                MessageBox.error("Không thể lấy dữ liệu ca làm việc từ SAP Backend.");
            });
        },

        onPlantChange: function (oEvent) {
            var sPlant = oEvent.getSource().getValue();
            var oDialogModel = this.getView().getModel("dialogModel");

            oDialogModel.setProperty("/Plant", sPlant);
            oDialogModel.setProperty("/ShiftId", "");

            this._loadShiftLookup(sPlant);
        },

        /*
         * Search help nhân viên
         */
        _loadEmployeeLookup: function () {
            var oODataModel = this.getView().getModel();
            var oEmployeeModel = this.getView().getModel("employeeLookupModel");

            if (!oODataModel) {
                return Promise.resolve([]);
            }

            return new Promise(function (resolve, reject) {
                oODataModel.read("/Employee", {
                    success: function (oData) {
                        var aEmployees = (oData.results || []).map(function (item) {
                            return {
                                Pernr: item.Pernr || item.pernr || "",
                                EmployeeName: item.EmployeeName || item.Ename || item.ename || item.Name || "Nhân viên chưa có tên",
                                DeptId: item.DeptId || item.dept_id || "",
                                Plant: item.Plant || item.plant || "1000"
                            };
                        });

                        oEmployeeModel.setProperty("/employees", aEmployees);
                        oEmployeeModel.setProperty("/allEmployees", aEmployees);

                        resolve(aEmployees);
                    },
                    error: function (oError) {
                        console.error("Lỗi đọc /Employee:", oError);
                        reject(oError);
                    }
                });
            });
        },

        onPernrInputValueHelpRequest: function () {
            var oView = this.getView();

            var fnOpenDialog = function () {
                if (!this.pEmployeeDialog) {
                    this.pEmployeeDialog = Fragment.load({
                        id: oView.getId(),
                        name: "com.app.zu26g13.app.view.EmployeeValueHelp",
                        controller: this
                    }).then(function (oDialog) {
                        oView.addDependent(oDialog);
                        return oDialog;
                    });
                }

                this.pEmployeeDialog.then(function (oDialog) {
                    oDialog.open();
                });
            }.bind(this);

            var aEmployees = oView.getModel("employeeLookupModel").getProperty("/allEmployees") || [];

            if (aEmployees.length > 0) {
                fnOpenDialog();
                return;
            }

            sap.ui.core.BusyIndicator.show(0);

            this._loadEmployeeLookup().then(function () {
                sap.ui.core.BusyIndicator.hide();
                fnOpenDialog();
            }).catch(function () {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.error("Không thể lấy danh sách nhân viên.");
            });
        },

        onPernrInputLiveChange: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            this.getView().getModel("dialogModel").setProperty("/Pernr", sValue);
        },

        onEmployeeValueHelpSearch: function (oEvent) {
            var sValue = oEvent.getParameter("value") || "";
            var oEmployeeModel = this.getView().getModel("employeeLookupModel");
            var aAllEmployees = oEmployeeModel.getProperty("/allEmployees") || [];
            var sSearch = sValue.toLowerCase();

            var aFiltered = aAllEmployees.filter(function (item) {
                var sPernr = String(item.Pernr || "").toLowerCase();
                var sName = String(item.EmployeeName || "").toLowerCase();
                var sDept = String(item.DeptId || "").toLowerCase();

                return sPernr.indexOf(sSearch) !== -1 ||
                    sName.indexOf(sSearch) !== -1 ||
                    sDept.indexOf(sSearch) !== -1;
            });

            oEmployeeModel.setProperty("/employees", aFiltered);
        },

        onEmployeeValueHelpConfirm: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");

            if (!oSelectedItem) {
                return;
            }

            var oContext = oSelectedItem.getBindingContext("employeeLookupModel");

            if (!oContext) {
                return;
            }

            var oEmployee = oContext.getObject();
            var oDialogModel = this.getView().getModel("dialogModel");

            oDialogModel.setProperty("/Pernr", oEmployee.Pernr);

            if (oEmployee.Plant) {
                oDialogModel.setProperty("/Plant", oEmployee.Plant);
                this._loadShiftLookup(oEmployee.Plant);
            }
        },

        onEmployeeValueHelpCancel: function () {
            var oEmployeeModel = this.getView().getModel("employeeLookupModel");
            var aAllEmployees = oEmployeeModel.getProperty("/allEmployees") || [];

            oEmployeeModel.setProperty("/employees", aAllEmployees);
        },

        formatAppointmentType: function (sShiftId, sOtHours) {
            var fOt = parseFloat(sOtHours || "0");

            if (fOt > 0) {
                return sap.ui.unified.CalendarDayType.Type01;
            }

            if (sShiftId && sShiftId.toUpperCase() === "CA_01") {
                return sap.ui.unified.CalendarDayType.Type08;
            }

            if (sShiftId && sShiftId.toUpperCase() === "CA_02") {
                return sap.ui.unified.CalendarDayType.Type06;
            }

            if (sShiftId && sShiftId.toUpperCase() === "CA_03") {
                return sap.ui.unified.CalendarDayType.Type07;
            }

            return sap.ui.unified.CalendarDayType.Type09;
        },

        onAppointmentSelect: function (oEvent) {
            var oAppointment = oEvent.getParameter("appointment");

            if (!oAppointment) {
                return;
            }

            var oData = oAppointment.getBindingContext("calendarModel").getObject();
            var sFormattedDate = new Date(oData.PlanDate).toLocaleDateString("vi-VN");

            var sMessage =
                "Mã nhân viên: " + oData.Pernr + "\n" +
                "Ngày làm việc: " + sFormattedDate + "\n" +
                "Ca: " + oData.ShiftId + "\n" +
                "Số giờ OT: " + oData.OtHours + " tiếng\n" +
                "Nhà máy: " + oData.Plant;

            MessageBox.show(sMessage, {
                icon: MessageBox.Icon.INFORMATION,
                title: "Chi tiết lịch làm việc",
                actions: ["Đóng", "Sửa", "Xóa"],
                onClose: function (sAction) {
                    if (sAction === "Xóa") {
                        this._deleteSchedule(oData);
                    } else if (sAction === "Sửa") {
                        this._openEditDialog(oData);
                    }
                }.bind(this)
            });
        },

        onOpenCreateDialog: function () {
            var oModel = this.getView().getModel("dialogModel");
            var oData = this._getDefaultDialogData();

            oModel.setData(oData);

            this._loadShiftLookup(oData.Plant);
            this._openDialog();
        },

        _openEditDialog: function (oData) {
            var oModel = this.getView().getModel("dialogModel");

            oModel.setData({
                Pernr: oData.Pernr,
                PlanDate: oData.PlanDate,
                StartDate: oData.PlanDate,
                EndDate: oData.PlanDate,
                ShiftId: oData.ShiftId,
                OldShiftId: oData.OldShiftId || oData.ShiftId,
                OtHours: oData.OtHours || "0.00",
                Plant: oData.Plant || "1000",
                IsOt: parseFloat(oData.OtHours || "0") > 0,
                isEdit: true,
                sEmpShiftPath: oData.sEmpShiftPath,
                sOtPath: oData.sOtPath
            });

            this._loadShiftLookup(oData.Plant || "1000");
            this._openDialog();
        },

        onSearchEmployee: function (oEvent) {
            var sQuery = oEvent.getParameter("query");
            var aFilters = [];

            if (sQuery && sQuery.length > 0) {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("EmployeeName", FilterOperator.Contains, sQuery),
                        new Filter("Pernr", FilterOperator.Contains, sQuery)
                    ],
                    and: false
                }));
            }

            var oCalendar = this.byId("idPlanningCalendar");
            var oBinding = oCalendar.getBinding("rows");

            if (oBinding) {
                oBinding.filter(aFilters);
            }
        },

        _openDialog: function () {
            var oView = this.getView();

            if (!this.pDialog) {
                this.pDialog = Fragment.load({
                    id: oView.getId(),
                    name: "com.app.zu26g13.app.view.AddOtDialog",
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

        onCloseAddDialog: function () {
            if (this.pDialog) {
                this.pDialog.then(function (oDialog) {
                    oDialog.close();
                });
            }
        },

        onSaveOtPlan: function () {
            var oView = this.getView();
            var oODataModel = oView.getModel();
            var oDialogData = oView.getModel("dialogModel").getData();

            if (!oDialogData.Pernr || !oDialogData.ShiftId) {
                MessageBox.error("Vui lòng nhập Mã nhân viên và Ca làm việc.");
                return;
            }

            var fOtHours = parseFloat(oDialogData.OtHours || "0");

            if (isNaN(fOtHours)) {
                MessageBox.error("Số giờ OT không hợp lệ.");
                return;
            }

            sap.ui.core.BusyIndicator.show(0);

            if (oDialogData.isEdit) {
                this._saveEditSchedule(oODataModel, oDialogData, fOtHours);
                return;
            }

            this._saveCreateSchedule(oODataModel, oDialogData, fOtHours);
        },

        _saveCreateSchedule: function (oODataModel, oDialogData, fOtHours) {
            var dStart = this._normalizeDate(oDialogData.StartDate);
            var dEnd = this._normalizeDate(oDialogData.EndDate);

            if (dStart > dEnd) {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.error("Khoảng thời gian chọn không hợp lệ!");
                return;
            }

            var aDates = [];
            var dCurrent = new Date(dStart);

            while (dCurrent <= dEnd) {
                aDates.push(this._normalizeDate(dCurrent));
                dCurrent.setDate(dCurrent.getDate() + 1);
            }

            var pChain = Promise.resolve();

            aDates.forEach(function (dWorkDate) {
                pChain = pChain.then(function () {
                    return this._replaceEmpShiftForDate(
                        oODataModel,
                        oDialogData.Pernr,
                        dWorkDate,
                        oDialogData.ShiftId
                    );
                }.bind(this)).then(function () {
                    if (fOtHours > 0) {
                        return this._upsertOtPlan(oODataModel, {
                            Pernr: oDialogData.Pernr,
                            PlanDate: this._toODataDate(dWorkDate),
                            ShiftId: oDialogData.ShiftId,
                            OtHours: fOtHours.toFixed(2),
                            Plant: oDialogData.Plant || "1000",
                            IsOt: true
                        });
                    }

                    return this._removeOtPlanByKey(
                        oODataModel,
                        oDialogData.Pernr,
                        dWorkDate
                    );
                }.bind(this));
            }.bind(this));

            pChain.then(function () {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.success("Đã lưu ca vào ZTA_EMP_SHIFT thành công!");
                this.onCloseAddDialog();
                this._loadCalendarData();
            }.bind(this)).catch(function (oError) {
                sap.ui.core.BusyIndicator.hide();
                console.error("Lỗi lưu dữ liệu:", oError);
                MessageBox.error("Có lỗi khi lưu ca làm việc hoặc OT.");
            });
        },

        _saveEditSchedule: function (oODataModel, oDialogData, fOtHours) {
            var dWorkDate = this._normalizeDate(oDialogData.PlanDate);
            var dODataWorkDate = this._toODataDate(dWorkDate);

            var pSaveShift;

            if (oDialogData.OldShiftId && oDialogData.OldShiftId !== oDialogData.ShiftId) {
                var sOldPath = this._buildEmpShiftPath(
                    oODataModel,
                    oDialogData.Pernr,
                    dWorkDate,
                    oDialogData.OldShiftId
                );

                pSaveShift = this._deletePath(oODataModel, sOldPath, true).then(function () {
                    return this._createEmpShift(oODataModel, {
                        Pernr: oDialogData.Pernr,
                        WorkDate: dODataWorkDate,
                        ShiftId: oDialogData.ShiftId
                    });
                }.bind(this));
            } else {
                pSaveShift = this._replaceEmpShiftForDate(
                    oODataModel,
                    oDialogData.Pernr,
                    dWorkDate,
                    oDialogData.ShiftId
                );
            }

            var pSaveOt;

            if (fOtHours > 0) {
                pSaveOt = this._upsertOtPlan(oODataModel, {
                    Pernr: oDialogData.Pernr,
                    PlanDate: this._toODataDate(dWorkDate),
                    ShiftId: oDialogData.ShiftId,
                    OtHours: fOtHours.toFixed(2),
                    Plant: oDialogData.Plant || "1000",
                    IsOt: true
                });
            } else {
                pSaveOt = this._removeOtPlanByKey(
                    oODataModel,
                    oDialogData.Pernr,
                    dWorkDate
                );
            }

            pSaveShift.then(function () {
                return pSaveOt;
            }).then(function () {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.success("Đã cập nhật ca làm việc thành công!");
                this.onCloseAddDialog();
                this._loadCalendarData();
            }.bind(this)).catch(function (oError) {
                sap.ui.core.BusyIndicator.hide();
                console.error("Lỗi cập nhật:", oError);
                MessageBox.error("Có lỗi khi cập nhật ca làm việc.");
            });
        },

        _deleteSchedule: function (oData) {
            var oODataModel = this.getView().getModel();
            var aPromises = [];

            sap.ui.core.BusyIndicator.show(0);

            if (oData.Pernr && oData.WorkDate && oData.ShiftId) {
                var sEmpShiftPath = this._buildEmpShiftPath(
                    oODataModel,
                    oData.Pernr,
                    oData.WorkDate,
                    oData.ShiftId
                );

                aPromises.push(this._deletePath(oODataModel, sEmpShiftPath, false));
            }

            if (oData.sOtPath) {
                aPromises.push(this._deletePath(oODataModel, oData.sOtPath, true));
            }

            Promise.all(aPromises).then(function () {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.success("Đã xóa ca làm việc thành công!");
                this._loadCalendarData();
            }.bind(this)).catch(function (oError) {
                sap.ui.core.BusyIndicator.hide();
                console.error("Lỗi xóa:", oError);
                MessageBox.error("Có lỗi xảy ra khi xóa ca làm việc.");
            });
        },

        _replaceEmpShiftForDate: function (oODataModel, sPernr, dWorkDate, sShiftId) {
            var dODataWorkDate = this._toODataDate(dWorkDate);

            return this._readEmpShiftByDate(oODataModel, sPernr, dWorkDate).then(function (aExisting) {
                var pDeleteChain = Promise.resolve();

                aExisting.forEach(function (item) {
                    pDeleteChain = pDeleteChain.then(function () {
                        var sPath = this._buildEmpShiftPath(
                            oODataModel,
                            item.Pernr,
                            this._toDate(item.WorkDate),
                            item.ShiftId
                        );

                        return this._deletePath(oODataModel, sPath, true);
                    }.bind(this));
                }.bind(this));

                return pDeleteChain.then(function () {
                    return this._createEmpShift(oODataModel, {
                        Pernr: sPernr,
                        WorkDate: dODataWorkDate,
                        ShiftId: sShiftId
                    });
                }.bind(this));
            }.bind(this));
        },

        _readEmpShiftByDate: function (oODataModel, sPernr, dWorkDate) {
            return new Promise(function (resolve, reject) {
                oODataModel.read("/EmpShift", {
                    filters: [
                        new Filter("Pernr", FilterOperator.EQ, sPernr),
                        new Filter("WorkDate", FilterOperator.EQ, this._toODataDate(dWorkDate))
                    ],
                    success: function (oData) {
                        resolve(oData.results || []);
                    },
                    error: function (oError) {
                        reject(oError);
                    }
                });
            }.bind(this));
        },

        _createEmpShift: function (oODataModel, oPayload) {
            return new Promise(function (resolve, reject) {
                oODataModel.create("/EmpShift", oPayload, {
                    success: function () {
                        resolve();
                    },
                    error: function (oError) {
                        console.error("Lỗi create /EmpShift:", oError);
                        reject(oError);
                    }
                });
            });
        },

        _upsertOtPlan: function (oODataModel, oPayload) {
            var sPath = oODataModel.createKey("/OtPlan", {
                Pernr: oPayload.Pernr,
                PlanDate: oPayload.PlanDate
            });

            var oUpdatePayload = {
                ShiftId: oPayload.ShiftId,
                OtHours: oPayload.OtHours,
                Plant: oPayload.Plant,
                IsOt: oPayload.IsOt
            };

            return new Promise(function (resolve, reject) {
                oODataModel.update(sPath, oUpdatePayload, {
                    success: function () {
                        resolve();
                    },
                    error: function (oUpdateError) {
                        var iStatusCode = Number(oUpdateError && oUpdateError.statusCode);

                        if (iStatusCode !== 404) {
                            reject(oUpdateError);
                            return;
                        }

                        oODataModel.create("/OtPlan", oPayload, {
                            success: function () {
                                resolve();
                            },
                            error: function (oCreateError) {
                                reject(oCreateError);
                            }
                        });
                    }
                });
            });
        },

        _removeOtPlanByKey: function (oODataModel, sPernr, dPlanDate) {
            var sPath = oODataModel.createKey("/OtPlan", {
                Pernr: sPernr,
                PlanDate: this._toODataDate(dPlanDate)
            });

            return this._deletePath(oODataModel, sPath, true);
        },

        _deletePath: function (oODataModel, sPath, bIgnoreNotFound) {
            return new Promise(function (resolve, reject) {
                if (!sPath) {
                    resolve();
                    return;
                }

                oODataModel.remove(sPath, {
                    success: function () {
                        resolve();
                    },
                    error: function (oError) {
                        var iStatusCode = Number(oError && oError.statusCode);

                        if (bIgnoreNotFound && iStatusCode === 404) {
                            console.warn("Record không tồn tại, bỏ qua:", sPath);
                            resolve();
                            return;
                        }

                        console.error("Xóa lỗi:", sPath, oError);
                        reject(oError);
                    }
                });
            });
        },

        _readSet: function (sPath) {
            var oODataModel = this.getView().getModel();

            return new Promise(function (resolve, reject) {
                oODataModel.read(sPath, {
                    success: function (oData) {
                        resolve(oData.results || []);
                    },
                    error: function (oError) {
                        reject(oError);
                    }
                });
            });
        },

        _toODataDate: function (vDate) {
            var dDate = this._normalizeDate(vDate);

            return new Date(Date.UTC(
                dDate.getFullYear(),
                dDate.getMonth(),
                dDate.getDate(),
                0,
                0,
                0
            ));
        },

        _buildEmpShiftPath: function (oODataModel, sPernr, vWorkDate, sShiftId) {
            return oODataModel.createKey("/EmpShift", {
                Pernr: sPernr,
                WorkDate: this._toODataDate(vWorkDate),
                ShiftId: sShiftId
            });
        },

        _normalizeDate: function (vDate) {
            var dDate = new Date(vDate);
            dDate.setHours(0, 0, 0, 0);
            return dDate;
        },

        _toDate: function (vDate) {
            if (!vDate) {
                return new Date();
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

        _dateKey: function (vDate) {
            var dDate = this._normalizeDate(vDate);
            var sYear = dDate.getFullYear();
            var sMonth = String(dDate.getMonth() + 1).padStart(2, "0");
            var sDay = String(dDate.getDate()).padStart(2, "0");

            return sYear + "-" + sMonth + "-" + sDay;
        },

        _getHoursMinutes: function (vTime) {
            if (!vTime) {
                return {
                    hours: 8,
                    minutes: 0
                };
            }

            if (typeof vTime === "object" && vTime.ms !== undefined) {
                var iTotalSeconds = Math.floor(vTime.ms / 1000);

                return {
                    hours: Math.floor(iTotalSeconds / 3600),
                    minutes: Math.floor((iTotalSeconds % 3600) / 60)
                };
            }

            var sTime = String(vTime);
            var aMatch = sTime.match(/^PT(\d+)H(\d+)M/);

            if (aMatch) {
                return {
                    hours: parseInt(aMatch[1], 10),
                    minutes: parseInt(aMatch[2], 10)
                };
            }

            if (/^\d{6}$/.test(sTime)) {
                return {
                    hours: parseInt(sTime.substring(0, 2), 10),
                    minutes: parseInt(sTime.substring(2, 4), 10)
                };
            }

            if (/^\d{2}:\d{2}:\d{2}$/.test(sTime)) {
                return {
                    hours: parseInt(sTime.substring(0, 2), 10),
                    minutes: parseInt(sTime.substring(3, 5), 10)
                };
            }

            return {
                hours: 8,
                minutes: 0
            };
        },

        _formatTime: function (vTime) {
            var oTime = this._getHoursMinutes(vTime);

            return String(oTime.hours).padStart(2, "0") + ":" +
                String(oTime.minutes).padStart(2, "0");
        }

    });
});