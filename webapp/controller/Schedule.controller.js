sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/thirdparty/jquery"
], function (Controller, MessageBox, Fragment, JSONModel, Filter, FilterOperator, jQuery) {
    "use strict";

    return Controller.extend("com.app.zu26g13.app.controller.Schedule", {

        onInit: function () {
            var oODataModel = this.getOwnerComponent().getModel();

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

            this.getView().setModel(new JSONModel({
                departments: [],
                allDepartments: []
            }), "departmentLookupModel");

            this.getView().setModel(new JSONModel({
                employeeQuery: "",
                employeeFilter: "",
                deptQuery: "",
                deptFilter: ""
            }), "headerSearchModel");

            this.getView().setModel(
                new JSONModel(this._getDefaultDialogData()),
                "dialogModel"
            );

            this._sEmployeeValueHelpMode = "dialog";
            this._sDepartmentValueHelpMode = "dialog";

            this.getView().attachEventOnce("modelContextChange", function () {
                this._loadShiftLookup();
                this._loadCalendarData();
            }, this);
        },

        onAfterRendering: function () {
            this._installHideMonthsOption();
        },

        onExit: function () {
            jQuery(document).off(".hidePlanningCalendarMonths");
        },

        _installHideMonthsOption: function () {
            if (this._bHideMonthsOptionInstalled) {
                return;
            }

            this._bHideMonthsOptionInstalled = true;

            var fnHideMonths = function () {
                this._hideMonthsOption();
            }.bind(this);

            jQuery(document).on("click.hidePlanningCalendarMonths", function () {
                setTimeout(fnHideMonths, 50);
                setTimeout(fnHideMonths, 150);
                setTimeout(fnHideMonths, 300);
            });

            jQuery(document).on("keydown.hidePlanningCalendarMonths", function () {
                setTimeout(fnHideMonths, 50);
                setTimeout(fnHideMonths, 150);
                setTimeout(fnHideMonths, 300);
            });

            fnHideMonths();
        },

        _hideMonthsOption: function () {
            jQuery(".sapMSelectListItemBase, .sapMSelectListItem").each(function () {
                var oItem = jQuery(this);
                var sText = oItem.text().trim();

                if (sText === "Months") {
                    oItem.hide();
                    oItem.attr("aria-hidden", "true");
                }
            });
        },

        _getDefaultDialogData: function () {
            return {
                AssignMode: "EMP",
                Pernr: "",
                EmployeeName: "",
                DeptId: "",
                DeptName: "",
                StartDate: new Date(),
                EndDate: new Date(),
                PlanDate: new Date(),
                ShiftId: "",
                OldShiftId: "",
                OtHours: "0.00",
                IsOt: false,
                isEdit: false,
                sEmpShiftPath: "",
                sOtPath: ""
            };
        },

        _loadShiftLookup: function () {
            var oODataModel = this.getView().getModel();
            var oShiftLookupModel = this.getView().getModel("shiftLookupModel");
            var oDialogModel = this.getView().getModel("dialogModel");

            if (!oODataModel) {
                return;
            }

            oODataModel.read("/ShiftLookup", {
                success: function (oData) {
                    var aShifts = (oData.results || []).map(function (item) {
                        return {
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
                    MessageBox.error(this._getODataErrorMessage(
                        oError,
                        "Không thể lấy danh sách ca làm việc từ bảng ZTA_SCHEDULE."
                    ), {
                        title: "Không thể tải ca làm việc"
                    });
                }.bind(this)
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
                                DeptId: item.DeptId || "",
                                DeptName: item.DeptName || "",
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
                            DeptId: item.DeptId || "",
                            DeptName: item.DeptName || "",

                            PlanDate: dWorkDate,
                            WorkDate: dWorkDate,
                            StartDate: dStartDate,
                            EndDate: dEndDate,

                            ShiftId: item.ShiftId,
                            OldShiftId: item.ShiftId,
                            ShiftTimeIn: sShiftTimeIn,
                            ShiftTimeOut: sShiftTimeOut,
                            ShiftTimeText: sShiftTimeText,
                            OtHours: sOtHours,
                            IsOt: oOt ? oOt.IsOt : false,

                            AppointmentTitle: "Ca: " + item.ShiftId,
                            AppointmentText: sShiftTimeText + " | OT: " + sOtHours + "h",
                            AppointmentTooltip:
                                "NV: " + (item.EmployeeName || item.Pernr) +
                                " | Phòng ban: " + (item.DeptName || item.DeptId || "Không có") +
                                " | Ca: " + item.ShiftId +
                                " | Giờ: " + sShiftTimeText +
                                " | OT: " + sOtHours + "h",

                            sEmpShiftPath: sEmpShiftPath,
                            sOtPath: sOtPath
                        });
                    }.bind(this));

                    oCalendarModel.setProperty("/employees", Object.values(oGrouped));

                    setTimeout(function () {
                        this._hideMonthsOption();
                        this._applyHeaderFilters();
                    }.bind(this), 100);
                }.bind(this));
            }.bind(this)).catch(function (oError) {
                sap.ui.core.BusyIndicator.hide();
                console.error("Lỗi đọc /EmpShift:", oError);
                MessageBox.error(this._getODataErrorMessage(
                    oError,
                    "Không thể lấy dữ liệu ca làm việc từ SAP Backend."
                ), {
                    title: "Không thể tải lịch làm việc"
                });
            }.bind(this));
        },

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
                                EmployeeName: item.EmployeeName ||
                                    item.Ename ||
                                    item.ename ||
                                    item.Name ||
                                    item.name ||
                                    "Nhân viên chưa có tên",
                                DeptId: item.DeptId ||
                                    item.dept_id ||
                                    item.Department ||
                                    item.department ||
                                    "",
                                DeptName: item.DeptName ||
                                    item.dept_name ||
                                    ""
                            };
                        });

                        aEmployees.sort(function (a, b) {
                            return String(a.EmployeeName || "").localeCompare(
                                String(b.EmployeeName || ""),
                                "vi"
                            );
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

        _loadDepartmentLookup: function () {
            var oODataModel = this.getView().getModel();
            var oDepartmentModel = this.getView().getModel("departmentLookupModel");

            if (!oODataModel) {
                return Promise.resolve([]);
            }

            return new Promise(function (resolve, reject) {
                oODataModel.read("/Department", {
                    success: function (oData) {
                        var aDepartments = (oData.results || []).map(function (item) {
                            return {
                                DeptId: item.DeptId || item.dept_id || "",
                                DeptName: item.DeptName || item.dept_name || ""
                            };
                        });

                        aDepartments.sort(function (a, b) {
                            return String(a.DeptName || "").localeCompare(
                                String(b.DeptName || ""),
                                "vi"
                            );
                        });

                        oDepartmentModel.setProperty("/departments", aDepartments);
                        oDepartmentModel.setProperty("/allDepartments", aDepartments);

                        resolve(aDepartments);
                    },
                    error: function (oError) {
                        console.error("Lỗi đọc /Department:", oError);
                        reject(oError);
                    }
                });
            });
        },

        onHeaderEmployeeValueHelpRequest: function () {
            this._openEmployeeValueHelp("headerEmployee");
        },

        onHeaderEmployeeLiveChange: function (oEvent) {
            var sValue = oEvent.getParameter("value") || oEvent.getParameter("newValue") || "";
            var oHeaderModel = this.getView().getModel("headerSearchModel");

            oHeaderModel.setProperty("/employeeQuery", sValue);
            oHeaderModel.setProperty("/employeeFilter", sValue);

            this._applyHeaderFilters();
        },

        onHeaderEmployeeSubmit: function (oEvent) {
            var sValue = oEvent.getParameter("value") || "";
            var oHeaderModel = this.getView().getModel("headerSearchModel");

            oHeaderModel.setProperty("/employeeQuery", sValue);
            oHeaderModel.setProperty("/employeeFilter", sValue);

            this._applyHeaderFilters();
        },

        onHeaderDepartmentValueHelpRequest: function () {
            this._openDepartmentValueHelp("headerDepartment");
        },

        onHeaderDepartmentLiveChange: function (oEvent) {
            var sValue = oEvent.getParameter("value") || oEvent.getParameter("newValue") || "";
            var oHeaderModel = this.getView().getModel("headerSearchModel");

            oHeaderModel.setProperty("/deptQuery", sValue);
            oHeaderModel.setProperty("/deptFilter", sValue);

            this._applyHeaderFilters();
        },

        onHeaderDepartmentSubmit: function (oEvent) {
            var sValue = oEvent.getParameter("value") || "";
            var oHeaderModel = this.getView().getModel("headerSearchModel");

            oHeaderModel.setProperty("/deptQuery", sValue);
            oHeaderModel.setProperty("/deptFilter", sValue);

            this._applyHeaderFilters();
        },

        onClearHeaderFilters: function () {
            var oHeaderModel = this.getView().getModel("headerSearchModel");

            oHeaderModel.setData({
                employeeQuery: "",
                employeeFilter: "",
                deptQuery: "",
                deptFilter: ""
            });

            this._applyHeaderFilters();
        },

        _applyHeaderFilters: function () {
            var oCalendar = this.byId("idPlanningCalendar");
            var oBinding = oCalendar && oCalendar.getBinding("rows");

            if (!oBinding) {
                return;
            }

            var oHeaderModel = this.getView().getModel("headerSearchModel");

            var sEmployee = String(
                oHeaderModel.getProperty("/employeeFilter") ||
                oHeaderModel.getProperty("/employeeQuery") ||
                ""
            ).trim();

            var sDept = String(
                oHeaderModel.getProperty("/deptFilter") ||
                oHeaderModel.getProperty("/deptQuery") ||
                ""
            ).trim();

            var aFilters = [];

            if (sEmployee) {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("EmployeeName", FilterOperator.Contains, sEmployee),
                        new Filter("Pernr", FilterOperator.Contains, sEmployee)
                    ],
                    and: false
                }));
            }

            if (sDept) {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("DeptId", FilterOperator.Contains, sDept),
                        new Filter("DeptName", FilterOperator.Contains, sDept)
                    ],
                    and: false
                }));
            }

            oBinding.filter(aFilters);
        },

        onPernrInputValueHelpRequest: function () {
            this._openEmployeeValueHelp("dialog");
        },

        onPernrInputLiveChange: function (oEvent) {
            var sValue = oEvent.getParameter("value") || "";
            var oDialogModel = this.getView().getModel("dialogModel");

            oDialogModel.setProperty("/Pernr", sValue);
            oDialogModel.setProperty("/EmployeeName", "");
            oDialogModel.setProperty("/DeptName", "");
        },

        _openEmployeeValueHelp: function (sMode) {
            var oView = this.getView();
            var oEmployeeModel = oView.getModel("employeeLookupModel");
            var aEmployees = oEmployeeModel.getProperty("/allEmployees") || [];

            this._sEmployeeValueHelpMode = sMode || "dialog";

            var fnOpenDialog = function () {
                var aAllEmployees = oEmployeeModel.getProperty("/allEmployees") || [];
                oEmployeeModel.setProperty("/employees", aAllEmployees);

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
                MessageBox.error("Không thể lấy danh sách nhân viên.", {
                    title: "Lỗi dữ liệu nhân viên"
                });
            });
        },

        onEmployeeValueHelpSearch: function (oEvent) {
            var sValue = oEvent.getParameter("value") || "";
            var oEmployeeModel = this.getView().getModel("employeeLookupModel");
            var aAllEmployees = oEmployeeModel.getProperty("/allEmployees") || [];
            var sSearch = sValue.toLowerCase().trim();

            if (!sSearch) {
                oEmployeeModel.setProperty("/employees", aAllEmployees);
                return;
            }

            var aFiltered = aAllEmployees.filter(function (item) {
                return String(item.Pernr || "").toLowerCase().indexOf(sSearch) !== -1 ||
                    String(item.EmployeeName || "").toLowerCase().indexOf(sSearch) !== -1 ||
                    String(item.DeptId || "").toLowerCase().indexOf(sSearch) !== -1 ||
                    String(item.DeptName || "").toLowerCase().indexOf(sSearch) !== -1;
            });

            oEmployeeModel.setProperty("/employees", aFiltered);
        },

        onEmployeeValueHelpConfirm: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");

            if (!oSelectedItem) {
                this._resetEmployeeValueHelpList();
                return;
            }

            var oContext = oSelectedItem.getBindingContext("employeeLookupModel");

            if (!oContext) {
                this._resetEmployeeValueHelpList();
                return;
            }

            var oEmployee = oContext.getObject();

            if (this._sEmployeeValueHelpMode === "headerEmployee") {
                var sDisplayText = (oEmployee.EmployeeName || "Nhân viên") + " (" + oEmployee.Pernr + ")";
                var oHeaderModel = this.getView().getModel("headerSearchModel");

                oHeaderModel.setProperty("/employeeQuery", sDisplayText);
                oHeaderModel.setProperty("/employeeFilter", oEmployee.Pernr);

                this._sEmployeeValueHelpMode = "dialog";
                this._resetEmployeeValueHelpList();
                this._applyHeaderFilters();

                return;
            }

            var oDialogModel = this.getView().getModel("dialogModel");

            oDialogModel.setProperty("/Pernr", oEmployee.Pernr);
            oDialogModel.setProperty("/EmployeeName", oEmployee.EmployeeName || "");
            oDialogModel.setProperty("/DeptId", oEmployee.DeptId || "");
            oDialogModel.setProperty("/DeptName", oEmployee.DeptName || "");

            this._sEmployeeValueHelpMode = "dialog";
            this._resetEmployeeValueHelpList();
        },

        onEmployeeValueHelpCancel: function () {
            this._sEmployeeValueHelpMode = "dialog";
            this._resetEmployeeValueHelpList();
        },

        _resetEmployeeValueHelpList: function () {
            var oEmployeeModel = this.getView().getModel("employeeLookupModel");

            if (!oEmployeeModel) {
                return;
            }

            var aAllEmployees = oEmployeeModel.getProperty("/allEmployees") || [];
            oEmployeeModel.setProperty("/employees", aAllEmployees);
        },

        onDeptInputValueHelpRequest: function () {
            this._openDepartmentValueHelp("dialog");
        },

        onDeptInputLiveChange: function (oEvent) {
            var sValue = oEvent.getParameter("value") || "";
            var oDialogModel = this.getView().getModel("dialogModel");

            oDialogModel.setProperty("/DeptId", sValue);
            oDialogModel.setProperty("/DeptName", "");
        },

        _openDepartmentValueHelp: function (sMode) {
            var oView = this.getView();
            var oDepartmentModel = oView.getModel("departmentLookupModel");
            var aDepartments = oDepartmentModel.getProperty("/allDepartments") || [];

            this._sDepartmentValueHelpMode = sMode || "dialog";

            var fnOpenDialog = function () {
                var aAllDepartments = oDepartmentModel.getProperty("/allDepartments") || [];
                oDepartmentModel.setProperty("/departments", aAllDepartments);

                if (!this.pDepartmentDialog) {
                    this.pDepartmentDialog = Fragment.load({
                        id: oView.getId(),
                        name: "com.app.zu26g13.app.view.DepartmentValueHelp",
                        controller: this
                    }).then(function (oDialog) {
                        oView.addDependent(oDialog);
                        return oDialog;
                    });
                }

                this.pDepartmentDialog.then(function (oDialog) {
                    oDialog.open();
                });
            }.bind(this);

            if (aDepartments.length > 0) {
                fnOpenDialog();
                return;
            }

            sap.ui.core.BusyIndicator.show(0);

            this._loadDepartmentLookup().then(function () {
                sap.ui.core.BusyIndicator.hide();
                fnOpenDialog();
            }).catch(function () {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.error("Không thể lấy danh sách phòng ban.", {
                    title: "Lỗi dữ liệu phòng ban"
                });
            });
        },

        onDepartmentValueHelpSearch: function (oEvent) {
            var sValue = oEvent.getParameter("value") || "";
            var oDepartmentModel = this.getView().getModel("departmentLookupModel");
            var aAllDepartments = oDepartmentModel.getProperty("/allDepartments") || [];
            var sSearch = sValue.toLowerCase().trim();

            if (!sSearch) {
                oDepartmentModel.setProperty("/departments", aAllDepartments);
                return;
            }

            var aFiltered = aAllDepartments.filter(function (item) {
                return String(item.DeptId || "").toLowerCase().indexOf(sSearch) !== -1 ||
                    String(item.DeptName || "").toLowerCase().indexOf(sSearch) !== -1;
            });

            oDepartmentModel.setProperty("/departments", aFiltered);
        },

        onDepartmentValueHelpConfirm: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("selectedItem");

            if (!oSelectedItem) {
                this._resetDepartmentValueHelpList();
                return;
            }

            var oContext = oSelectedItem.getBindingContext("departmentLookupModel");

            if (!oContext) {
                this._resetDepartmentValueHelpList();
                return;
            }

            var oDepartment = oContext.getObject();

            if (this._sDepartmentValueHelpMode === "headerDepartment") {
                var sDisplayText = (oDepartment.DeptName || "Phòng ban") + " (" + oDepartment.DeptId + ")";
                var oHeaderModel = this.getView().getModel("headerSearchModel");

                oHeaderModel.setProperty("/deptQuery", sDisplayText);
                oHeaderModel.setProperty("/deptFilter", oDepartment.DeptId);

                this._sDepartmentValueHelpMode = "dialog";
                this._resetDepartmentValueHelpList();
                this._applyHeaderFilters();

                return;
            }

            var oDialogModel = this.getView().getModel("dialogModel");

            oDialogModel.setProperty("/DeptId", oDepartment.DeptId);
            oDialogModel.setProperty("/DeptName", oDepartment.DeptName || "");

            this._sDepartmentValueHelpMode = "dialog";
            this._resetDepartmentValueHelpList();
        },

        onDepartmentValueHelpCancel: function () {
            this._sDepartmentValueHelpMode = "dialog";
            this._resetDepartmentValueHelpList();
        },

        _resetDepartmentValueHelpList: function () {
            var oDepartmentModel = this.getView().getModel("departmentLookupModel");

            if (!oDepartmentModel) {
                return;
            }

            var aAllDepartments = oDepartmentModel.getProperty("/allDepartments") || [];
            oDepartmentModel.setProperty("/departments", aAllDepartments);
        },

        onAssignModeChange: function (oEvent) {
            var sKey = oEvent.getParameter("key");

            if (!sKey) {
                var oItem = oEvent.getParameter("item");
                sKey = oItem && oItem.getKey ? oItem.getKey() : "EMP";
            }

            var oDialogModel = this.getView().getModel("dialogModel");

            oDialogModel.setProperty("/AssignMode", sKey);

            if (sKey === "EMP") {
                oDialogModel.setProperty("/DeptId", "");
                oDialogModel.setProperty("/DeptName", "");
            } else {
                oDialogModel.setProperty("/Pernr", "");
                oDialogModel.setProperty("/EmployeeName", "");
                oDialogModel.setProperty("/DeptId", "");
                oDialogModel.setProperty("/DeptName", "");
            }
        },

        onOpenCreateDialog: function () {
            var oModel = this.getView().getModel("dialogModel");
            var oData = this._getDefaultDialogData();

            oModel.setData(oData);

            this._loadShiftLookup();
            this._openDialog();
        },

        _openEditDialog: function (oData) {
            if (this._isPastDate(oData.PlanDate)) {
                MessageBox.error(this._getPastDateMessage(oData.PlanDate), {
                    title: "Không thể sửa lịch đã qua"
                });
                return;
            }

            var oModel = this.getView().getModel("dialogModel");

            oModel.setData({
                AssignMode: "EMP",
                Pernr: oData.Pernr,
                EmployeeName: oData.EmployeeName || "",
                DeptId: oData.DeptId || "",
                DeptName: oData.DeptName || "",
                PlanDate: oData.PlanDate,
                StartDate: oData.PlanDate,
                EndDate: oData.PlanDate,
                ShiftId: oData.ShiftId,
                OldShiftId: oData.OldShiftId || oData.ShiftId,
                OtHours: oData.OtHours || "0.00",
                IsOt: parseFloat(oData.OtHours || "0") > 0,
                isEdit: true,
                sEmpShiftPath: oData.sEmpShiftPath,
                sOtPath: oData.sOtPath
            });

            this._loadShiftLookup();
            this._openDialog();
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

        onAppointmentSelect: function (oEvent) {
            var oAppointment = oEvent.getParameter("appointment");

            if (!oAppointment) {
                return;
            }

            var oData = oAppointment.getBindingContext("calendarModel").getObject();
            var sFormattedDate = new Date(oData.PlanDate).toLocaleDateString("vi-VN");
            var bPastDate = this._isPastDate(oData.PlanDate);

            var sMessage =
                "Mã nhân viên: " + oData.Pernr + "\n" +
                "Tên nhân viên: " + (oData.EmployeeName || "") + "\n" +
                "Phòng ban: " + (oData.DeptName || oData.DeptId || "Không có") + "\n" +
                "Ngày làm việc: " + sFormattedDate + "\n" +
                "Ca: " + oData.ShiftId + "\n" +
                "Giờ làm: " + (oData.ShiftTimeText || "") + "\n" +
                "Số giờ OT: " + oData.OtHours + " tiếng\n";

            if (bPastDate) {
                sMessage += "\nLưu ý: Ngày này đã qua nên không được sửa hoặc xóa.";
            }

            MessageBox.show(sMessage, {
                icon: MessageBox.Icon.INFORMATION,
                title: "Chi tiết lịch làm việc",
                actions: bPastDate ? ["Đóng"] : ["Đóng", "Sửa", "Xóa"],
                emphasizedAction: "Đóng",
                onClose: function (sAction) {
                    if (bPastDate) {
                        return;
                    }

                    if (sAction === "Xóa") {
                        this._deleteSchedule(oData);
                    } else if (sAction === "Sửa") {
                        this._openEditDialog(oData);
                    }
                }.bind(this)
            });
        },

        onSaveOtPlan: function () {
            var oView = this.getView();
            var oODataModel = oView.getModel();
            var oDialogModel = oView.getModel("dialogModel");
            var oDialogData = oDialogModel.getData();

            var fOtHours = parseFloat(oDialogData.OtHours || "0");

            if (isNaN(fOtHours) || fOtHours < 0) {
                MessageBox.error("Số giờ OT không hợp lệ.", {
                    title: "Dữ liệu OT không hợp lệ"
                });
                return;
            }

            if (!oDialogData.ShiftId) {
                MessageBox.error("Vui lòng chọn Ca làm việc.", {
                    title: "Thiếu ca làm việc"
                });
                return;
            }

            sap.ui.core.BusyIndicator.show(0);

            if (oDialogData.isEdit) {
                if (!oDialogData.Pernr) {
                    sap.ui.core.BusyIndicator.hide();
                    MessageBox.error("Không xác định được nhân viên cần sửa.", {
                        title: "Thiếu nhân viên"
                    });
                    return;
                }

                if (this._isPastDate(oDialogData.PlanDate)) {
                    sap.ui.core.BusyIndicator.hide();
                    MessageBox.error(this._getPastDateMessage(oDialogData.PlanDate), {
                        title: "Không thể cập nhật lịch đã qua"
                    });
                    return;
                }

                this._saveEditSchedule(oODataModel, oDialogData, fOtHours);
                return;
            }

            if (oDialogData.AssignMode === "DEPT") {
                if (!oDialogData.DeptId) {
                    sap.ui.core.BusyIndicator.hide();
                    MessageBox.error("Vui lòng chọn phòng ban.", {
                        title: "Thiếu phòng ban"
                    });
                    return;
                }

                this._getEmployeesByDepartment(oDialogData.DeptId).then(function (aEmployees) {
                    if (aEmployees.length === 0) {
                        sap.ui.core.BusyIndicator.hide();
                        MessageBox.error("Phòng ban này chưa có nhân viên.", {
                            title: "Không có nhân viên"
                        });
                        return;
                    }

                    this._saveCreateScheduleForEmployees(
                        oODataModel,
                        oDialogData,
                        fOtHours,
                        aEmployees
                    );
                }.bind(this)).catch(function (oError) {
                    sap.ui.core.BusyIndicator.hide();
                    MessageBox.error(
                        this._getODataErrorMessage(oError, "Không thể lấy danh sách nhân viên theo phòng ban."),
                        {
                            title: "Lỗi dữ liệu phòng ban"
                        }
                    );
                }.bind(this));

                return;
            }

            if (!oDialogData.Pernr) {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.error("Vui lòng chọn nhân viên.", {
                    title: "Thiếu nhân viên"
                });
                return;
            }

            this._ensureEmployeeExists(oDialogData.Pernr).then(function (oEmployee) {
                oDialogData.Pernr = oEmployee.Pernr;

                oDialogModel.setProperty("/Pernr", oEmployee.Pernr);
                oDialogModel.setProperty("/EmployeeName", oEmployee.EmployeeName || "");
                oDialogModel.setProperty("/DeptId", oEmployee.DeptId || "");
                oDialogModel.setProperty("/DeptName", oEmployee.DeptName || "");

                this._saveCreateScheduleForEmployees(
                    oODataModel,
                    oDialogData,
                    fOtHours,
                    [oEmployee]
                );
            }.bind(this)).catch(function (oError) {
                sap.ui.core.BusyIndicator.hide();

                MessageBox.error(
                    oError && oError.message
                        ? oError.message
                        : "Mã nhân viên không tồn tại. Vui lòng chọn nhân viên từ search help.",
                    {
                        title: "Nhân viên không hợp lệ"
                    }
                );
            });
        },

        _getEmployeesByDepartment: function (sDeptId) {
            return this._loadEmployeeLookup().then(function () {
                var oEmployeeModel = this.getView().getModel("employeeLookupModel");
                var aEmployees = oEmployeeModel.getProperty("/allEmployees") || [];
                var sDept = String(sDeptId || "").trim().toUpperCase();

                return aEmployees.filter(function (item) {
                    return String(item.DeptId || "").trim().toUpperCase() === sDept;
                });
            }.bind(this));
        },

        _saveCreateScheduleForEmployees: function (oODataModel, oDialogData, fOtHours, aEmployees) {
            var dStart = this._normalizeDate(oDialogData.StartDate);
            var dEnd = this._normalizeDate(oDialogData.EndDate);

            if (dStart > dEnd) {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.error("Khoảng thời gian chọn không hợp lệ!", {
                    title: "Sai khoảng ngày"
                });
                return;
            }

            if (this._isPastDate(dStart)) {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.error(
                    "Khoảng thời gian có ngày đã qua.\n\n" +
                    "Từ ngày: " + dStart.toLocaleDateString("vi-VN") + "\n" +
                    "Hôm nay: " + this._getTodayDateOnly().toLocaleDateString("vi-VN") + "\n\n" +
                    "Vui lòng chọn ngày hôm nay hoặc ngày tương lai.",
                    {
                        title: "Không thể tạo lịch cho ngày đã qua"
                    }
                );
                return;
            }

            var aDates = [];
            var dCurrent = new Date(dStart);

            while (dCurrent <= dEnd) {
                aDates.push(this._normalizeDate(dCurrent));
                dCurrent.setDate(dCurrent.getDate() + 1);
            }

            var pChain = Promise.resolve();

            aEmployees.forEach(function (oEmployee) {
                aDates.forEach(function (dWorkDate) {
                    pChain = pChain.then(function () {
                        if (this._isPastDate(dWorkDate)) {
                            return Promise.reject({
                                message: this._getPastDateMessage(dWorkDate)
                            });
                        }

                        return this._createEmpShiftIfNotExists(
                            oODataModel,
                            oEmployee.Pernr,
                            dWorkDate,
                            oDialogData.ShiftId
                        );
                    }.bind(this)).then(function () {
                        if (fOtHours > 0) {
                            return this._upsertOtPlan(oODataModel, {
                                Pernr: oEmployee.Pernr,
                                PlanDate: this._toODataDate(dWorkDate),
                                ShiftId: oDialogData.ShiftId,
                                OtHours: fOtHours.toFixed(2),
                                IsOt: true
                            });
                        }

                        return Promise.resolve();
                    }.bind(this));
                }.bind(this));
            }.bind(this));

            pChain.then(function () {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.success("Đã thêm ca làm việc thành công!");
                this.onCloseAddDialog();
                this._loadCalendarData();
            }.bind(this)).catch(function (oError) {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.error(
                    this._getODataErrorMessage(oError, "Có lỗi khi lưu ca làm việc hoặc OT."),
                    {
                        title: "Không thể lưu lịch OT"
                    }
                );
            }.bind(this));
        },

        _saveEditSchedule: function (oODataModel, oDialogData, fOtHours) {
            var dWorkDate = this._normalizeDate(oDialogData.PlanDate);
            var dODataWorkDate = this._toODataDate(dWorkDate);

            if (this._isPastDate(dWorkDate)) {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.error(this._getPastDateMessage(dWorkDate), {
                    title: "Không thể cập nhật lịch đã qua"
                });
                return;
            }

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
                pSaveShift = Promise.resolve();
            }

            var pSaveOt;

            if (fOtHours > 0) {
                pSaveOt = this._upsertOtPlan(oODataModel, {
                    Pernr: oDialogData.Pernr,
                    PlanDate: this._toODataDate(dWorkDate),
                    ShiftId: oDialogData.ShiftId,
                    OtHours: fOtHours.toFixed(2),
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
                MessageBox.error(
                    this._getODataErrorMessage(oError, "Có lỗi khi cập nhật ca làm việc."),
                    {
                        title: "Không thể cập nhật lịch OT"
                    }
                );
            }.bind(this));
        },

        _deleteSchedule: function (oData) {
            if (this._isPastDate(oData.WorkDate || oData.PlanDate)) {
                MessageBox.error(this._getPastDateMessage(oData.WorkDate || oData.PlanDate), {
                    title: "Không thể xóa lịch đã qua"
                });
                return;
            }

            var oODataModel = this.getView().getModel();

            sap.ui.core.BusyIndicator.show(0);

            var pDeleteShift = Promise.resolve();

            if (oData.Pernr && oData.WorkDate && oData.ShiftId) {
                var sEmpShiftPath = this._buildEmpShiftPath(
                    oODataModel,
                    oData.Pernr,
                    oData.WorkDate,
                    oData.ShiftId
                );

                pDeleteShift = this._deletePath(oODataModel, sEmpShiftPath, false);
            }

            pDeleteShift.then(function () {
                return this._readEmpShiftByDate(
                    oODataModel,
                    oData.Pernr,
                    oData.WorkDate
                );
            }.bind(this)).then(function (aRemaining) {
                if (aRemaining.length === 0 && oData.sOtPath) {
                    return this._deletePath(oODataModel, oData.sOtPath, true);
                }

                return Promise.resolve();
            }.bind(this)).then(function () {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.success("Đã xóa ca làm việc thành công!");
                this._loadCalendarData();
            }.bind(this)).catch(function (oError) {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.error(
                    this._getODataErrorMessage(oError, "Có lỗi xảy ra khi xóa ca làm việc."),
                    {
                        title: "Không thể xóa lịch làm việc"
                    }
                );
            }.bind(this));
        },

        _createEmpShiftIfNotExists: function (oODataModel, sPernr, dWorkDate, sShiftId) {
            return this._readEmpShiftByDate(
                oODataModel,
                sPernr,
                dWorkDate
            ).then(function (aExisting) {
                if (aExisting.length > 0) {
                    var sDateText = this._normalizeDate(dWorkDate).toLocaleDateString("vi-VN");
                    var sOldShift = aExisting[0].ShiftId || "";

                    return Promise.reject({
                        message: "Nhân viên " + sPernr +
                            " đã có ca " + sOldShift +
                            " trong ngày " + sDateText +
                            ". Vui lòng chỉnh sửa ca hiện có thay vì tạo thêm."
                    });
                }

                return this._createEmpShift(oODataModel, {
                    Pernr: sPernr,
                    WorkDate: this._toODataDate(dWorkDate),
                    ShiftId: sShiftId
                });
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
                            resolve();
                            return;
                        }

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

        _ensureEmployeeExists: function (sPernr) {
            var oEmployee = this._findEmployeeByPernr(sPernr);

            if (oEmployee) {
                return Promise.resolve(oEmployee);
            }

            return this._loadEmployeeLookup().then(function () {
                var oFound = this._findEmployeeByPernr(sPernr);

                if (oFound) {
                    return oFound;
                }

                return Promise.reject({
                    message: "Mã nhân viên " + sPernr + " không tồn tại trong danh sách nhân viên. Vui lòng chọn bằng search help."
                });
            }.bind(this));
        },

        _findEmployeeByPernr: function (sPernr) {
            var oEmployeeModel = this.getView().getModel("employeeLookupModel");

            if (!oEmployeeModel) {
                return null;
            }

            var aEmployees = oEmployeeModel.getProperty("/allEmployees") || [];
            var sInput = this._normalizePernrForCompare(sPernr);

            for (var i = 0; i < aEmployees.length; i++) {
                var sCurrent = this._normalizePernrForCompare(aEmployees[i].Pernr);

                if (sCurrent === sInput) {
                    return aEmployees[i];
                }
            }

            return null;
        },

        _normalizePernrForCompare: function (vPernr) {
            var sPernr = String(vPernr || "").trim();

            if (!sPernr) {
                return "";
            }

            sPernr = sPernr.replace(/^0+/, "");

            return sPernr || "0";
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

        _getTodayDateOnly: function () {
            var dToday = new Date();
            dToday.setHours(0, 0, 0, 0);
            return dToday;
        },

        _isPastDate: function (vDate) {
            var dDate = this._normalizeDate(vDate);
            var dToday = this._getTodayDateOnly();

            return dDate < dToday;
        },

        _getPastDateMessage: function (vDate) {
            return "Ngày " + this._normalizeDate(vDate).toLocaleDateString("vi-VN") +
                " đã qua. Không được thêm, sửa hoặc xóa lịch làm việc cho ngày đã qua.";
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
                    hours: 0,
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
                hours: 0,
                minutes: 0
            };
        },

        _formatTime: function (vTime) {
            var oTime = this._getHoursMinutes(vTime);

            return String(oTime.hours).padStart(2, "0") + ":" +
                String(oTime.minutes).padStart(2, "0");
        },

        _getODataErrorMessage: function (oError, sDefaultMessage) {
            var aMessages = [];

            var fnAddMessage = function (sMessage) {
                if (!sMessage) {
                    return;
                }

                sMessage = String(sMessage).trim();

                if (!sMessage || sMessage === "HTTP request failed") {
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