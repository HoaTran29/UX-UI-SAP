sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/ui/core/Fragment",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/thirdparty/jquery",
  ],
  function (
    Controller,
    MessageBox,
    Fragment,
    JSONModel,
    Filter,
    FilterOperator,
    jQuery,
  ) {
    "use strict";

    return Controller.extend("com.app.zu26g13.app.controller.Schedule", {
      onInit: function () {
        var oODataModel = this.getOwnerComponent().getModel();

        if (oODataModel && oODataModel.setUseBatch) {
          oODataModel.setUseBatch(false);
        }

        this._sEmployeeValueHelpMode = "dialog";
        this._sDepartmentValueHelpMode = "dialog";

        this._initModels();

        this.getView().attachEventOnce(
          "modelContextChange",
          function () {
            this._loadShiftLookup();
            this._loadCalendarData();
          },
          this,
        );
      },

      onAfterRendering: function () {
        this._installHideMonthsOption();
      },

      onExit: function () {
        jQuery(document).off(".hidePlanningCalendarMonths");
      },

      _initModels: function () {
        this.getView().setModel(
          new JSONModel({
            employees: [],
          }),
          "calendarModel",
        );

        this.getView().setModel(
          new JSONModel({
            shifts: [],
          }),
          "shiftLookupModel",
        );

        this.getView().setModel(
          new JSONModel({
            employees: [],
            allEmployees: [],
          }),
          "employeeLookupModel",
        );

        this.getView().setModel(
          new JSONModel({
            departments: [],
            allDepartments: [],
          }),
          "departmentLookupModel",
        );

        this.getView().setModel(
          new JSONModel({
            employeeQuery: "",
            employeeFilter: "",
            deptQuery: "",
            deptFilter: "",
          }),
          "headerSearchModel",
        );

        this.getView().setModel(
          new JSONModel(this._getDefaultDialogData()),
          "dialogModel",
        );
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
          sOtPath: "",
        };
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
        jQuery(".sapMSelectListItemBase, .sapMSelectListItem").each(
          function () {
            var oItem = jQuery(this);
            var sText = oItem.text().trim();

            if (sText === "Months") {
              oItem.hide();
              oItem.attr("aria-hidden", "true");
            }
          },
        );
      },

      _loadCalendarData: function () {
        var oCalendarModel = this.getView().getModel("calendarModel");
        var oODataModel = this.getView().getModel();

        sap.ui.core.BusyIndicator.show(0);

        this._readSet("/EmpShift")
          .then(
            function (aEmpShift) {
              return this._readSet("/OtPlan")
                .catch(function () {
                  return [];
                })
                .then(
                  function (aOtPlan) {
                    var aEmployees = this._buildCalendarEmployees(
                      aEmpShift,
                      aOtPlan,
                      oODataModel,
                    );

                    oCalendarModel.setProperty("/employees", aEmployees);

                    sap.ui.core.BusyIndicator.hide();

                    setTimeout(
                      function () {
                        this._hideMonthsOption();
                        this._applyHeaderFilters();
                      }.bind(this),
                      100,
                    );
                  }.bind(this),
                );
            }.bind(this),
          )
          .catch(
            function (oError) {
              sap.ui.core.BusyIndicator.hide();
              console.error("Lỗi đọc /EmpShift:", oError);

              MessageBox.error(
                this._getODataErrorMessage(
                  oError,
                  "Không thể lấy dữ liệu ca làm việc từ SAP Backend.",
                ),
                {
                  title: "Không thể tải lịch làm việc",
                },
              );
            }.bind(this),
          );
      },

      _buildCalendarEmployees: function (aEmpShift, aOtPlan, oODataModel) {
        var mOtByKey = {};
        var oGrouped = {};

        aOtPlan.forEach(
          function (ot) {
            var sKey =
              ot.Pernr + "|" + this._dateKey(this._toDate(ot.PlanDate));
            mOtByKey[sKey] = ot;
          }.bind(this),
        );

        aEmpShift.forEach(
          function (item) {
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
                appointments: [],
              };
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
                "NV: " +
                (item.EmployeeName || item.Pernr) +
                " | Phòng ban: " +
                (item.DeptName || item.DeptId || "Không có") +
                " | Ca: " +
                item.ShiftId +
                " | Giờ: " +
                sShiftTimeText +
                " | OT: " +
                sOtHours +
                "h",

              sEmpShiftPath: this._buildEmpShiftPath(
                oODataModel,
                item.Pernr,
                dWorkDate,
                item.ShiftId,
              ),

              sOtPath: oOt
                ? oODataModel.createKey("/OtPlan", {
                    Pernr: oOt.Pernr,
                    PlanDate: this._toODataDate(this._toDate(oOt.PlanDate)),
                  })
                : "",
            });
          }.bind(this),
        );

        return Object.values(oGrouped);
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
            var aShifts = (oData.results || []).map(
              function (item) {
                return {
                  ShiftId: item.ShiftId,
                  TimeIn: item.TimeIn,
                  TimeOut: item.TimeOut,
                  ShiftText:
                    item.ShiftId +
                    " - " +
                    this._formatTime(item.TimeIn) +
                    " đến " +
                    this._formatTime(item.TimeOut),
                };
              }.bind(this),
            );

            oShiftLookupModel.setProperty("/shifts", aShifts);

            if (!oDialogModel.getProperty("/ShiftId") && aShifts.length > 0) {
              oDialogModel.setProperty("/ShiftId", aShifts[0].ShiftId);
            }
          }.bind(this),
          error: function (oError) {
            console.error("Lỗi đọc /ShiftLookup:", oError);

            MessageBox.error(
              this._getODataErrorMessage(
                oError,
                "Không thể lấy danh sách ca làm việc từ bảng ZTA_SCHEDULE.",
              ),
              {
                title: "Không thể tải ca làm việc",
              },
            );
          }.bind(this),
        });
      },

      _loadEmployeeLookup: function () {
        var oEmployeeModel = this.getView().getModel("employeeLookupModel");

        return this._readSet("/Employee")
          .then(function (aData) {
            var aEmployees = aData.map(function (item) {
              return {
                Pernr: item.Pernr || item.pernr || "",
                EmployeeName:
                  item.EmployeeName ||
                  item.Ename ||
                  item.ename ||
                  item.Name ||
                  item.name ||
                  "Nhân viên chưa có tên",
                DeptId:
                  item.DeptId ||
                  item.dept_id ||
                  item.Department ||
                  item.department ||
                  "",
                DeptName: item.DeptName || item.dept_name || "",
              };
            });

            aEmployees.sort(function (a, b) {
              return String(a.EmployeeName || "").localeCompare(
                String(b.EmployeeName || ""),
                "vi",
              );
            });

            oEmployeeModel.setProperty("/employees", aEmployees);
            oEmployeeModel.setProperty("/allEmployees", aEmployees);

            return aEmployees;
          })
          .catch(function (oError) {
            console.error("Lỗi đọc /Employee:", oError);
            throw oError;
          });
      },

      _loadDepartmentLookup: function () {
        var oDepartmentModel = this.getView().getModel("departmentLookupModel");

        return this._readSet("/Department")
          .then(function (aData) {
            var aDepartments = aData.map(function (item) {
              return {
                DeptId: item.DeptId || item.dept_id || "",
                DeptName: item.DeptName || item.dept_name || "",
              };
            });

            aDepartments.sort(function (a, b) {
              return String(a.DeptName || "").localeCompare(
                String(b.DeptName || ""),
                "vi",
              );
            });

            oDepartmentModel.setProperty("/departments", aDepartments);
            oDepartmentModel.setProperty("/allDepartments", aDepartments);

            return aDepartments;
          })
          .catch(function (oError) {
            console.error("Lỗi đọc /Department:", oError);
            throw oError;
          });
      },

      onHeaderEmployeeValueHelpRequest: function () {
        this._openEmployeeValueHelp("headerEmployee");
      },

      onHeaderEmployeeLiveChange: function (oEvent) {
        this._setHeaderFilter(
          "employee",
          oEvent.getParameter("value") || oEvent.getParameter("newValue") || "",
        );
      },

      onHeaderEmployeeSubmit: function (oEvent) {
        this._setHeaderFilter("employee", oEvent.getParameter("value") || "");
      },

      onHeaderDepartmentValueHelpRequest: function () {
        this._openDepartmentValueHelp("headerDepartment");
      },

      onHeaderDepartmentLiveChange: function (oEvent) {
        this._setHeaderFilter(
          "department",
          oEvent.getParameter("value") || oEvent.getParameter("newValue") || "",
        );
      },

      onHeaderDepartmentSubmit: function (oEvent) {
        this._setHeaderFilter("department", oEvent.getParameter("value") || "");
      },

      onClearHeaderFilters: function () {
        this.getView().getModel("headerSearchModel").setData({
          employeeQuery: "",
          employeeFilter: "",
          deptQuery: "",
          deptFilter: "",
        });

        this._applyHeaderFilters();
      },

      _setHeaderFilter: function (sType, sValue) {
        var oHeaderModel = this.getView().getModel("headerSearchModel");

        if (sType === "employee") {
          oHeaderModel.setProperty("/employeeQuery", sValue);
          oHeaderModel.setProperty("/employeeFilter", sValue);
        } else {
          oHeaderModel.setProperty("/deptQuery", sValue);
          oHeaderModel.setProperty("/deptFilter", sValue);
        }

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
            "",
        ).trim();

        var sDept = String(
          oHeaderModel.getProperty("/deptFilter") ||
            oHeaderModel.getProperty("/deptQuery") ||
            "",
        ).trim();

        var aFilters = [];

        if (sEmployee) {
          aFilters.push(
            new Filter({
              filters: [
                new Filter("EmployeeName", FilterOperator.Contains, sEmployee),
                new Filter("Pernr", FilterOperator.Contains, sEmployee),
              ],
              and: false,
            }),
          );
        }

        if (sDept) {
          aFilters.push(
            new Filter({
              filters: [
                new Filter("DeptId", FilterOperator.Contains, sDept),
                new Filter("DeptName", FilterOperator.Contains, sDept),
              ],
              and: false,
            }),
          );
        }

        oBinding.filter(aFilters);
      },

      onPernrInputValueHelpRequest: function () {
        this._openEmployeeValueHelp("dialog");
      },

      onPernrInputLiveChange: function (oEvent) {
        var oDialogModel = this.getView().getModel("dialogModel");

        oDialogModel.setProperty("/Pernr", oEvent.getParameter("value") || "");
        oDialogModel.setProperty("/EmployeeName", "");
        oDialogModel.setProperty("/DeptName", "");
      },

      _openEmployeeValueHelp: function (sMode) {
        var oEmployeeModel = this.getView().getModel("employeeLookupModel");
        var aEmployees = oEmployeeModel.getProperty("/allEmployees") || [];

        this._sEmployeeValueHelpMode = sMode || "dialog";

        var fnOpen = function () {
          oEmployeeModel.setProperty(
            "/employees",
            oEmployeeModel.getProperty("/allEmployees") || [],
          );

          this._openFragmentDialog(
            "pEmployeeDialog",
            "com.app.zu26g13.app.view.EmployeeValueHelp",
          );
        }.bind(this);

        if (aEmployees.length > 0) {
          fnOpen();
          return;
        }

        sap.ui.core.BusyIndicator.show(0);

        this._loadEmployeeLookup()
          .then(function () {
            sap.ui.core.BusyIndicator.hide();
            fnOpen();
          })
          .catch(function () {
            sap.ui.core.BusyIndicator.hide();

            MessageBox.error("Không thể lấy danh sách nhân viên.", {
              title: "Lỗi dữ liệu nhân viên",
            });
          });
      },

      onEmployeeValueHelpSearch: function (oEvent) {
        this._filterLookupModel(
          "employeeLookupModel",
          "/allEmployees",
          "/employees",
          oEvent.getParameter("value") || "",
          ["Pernr", "EmployeeName", "DeptId", "DeptName"],
        );
      },

      onEmployeeValueHelpConfirm: function (oEvent) {
        var oEmployee = this._getSelectedObject(oEvent, "employeeLookupModel");

        if (!oEmployee) {
          this._resetEmployeeValueHelpList();
          return;
        }

        if (this._sEmployeeValueHelpMode === "headerEmployee") {
          var oHeaderModel = this.getView().getModel("headerSearchModel");
          var sDisplayText =
            (oEmployee.EmployeeName || "Nhân viên") +
            " (" +
            oEmployee.Pernr +
            ")";

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
        this._resetLookupList(
          "employeeLookupModel",
          "/allEmployees",
          "/employees",
        );
      },

      onDeptInputValueHelpRequest: function () {
        this._openDepartmentValueHelp("dialog");
      },

      onDeptInputLiveChange: function (oEvent) {
        var oDialogModel = this.getView().getModel("dialogModel");

        oDialogModel.setProperty("/DeptId", oEvent.getParameter("value") || "");
        oDialogModel.setProperty("/DeptName", "");
      },

      _openDepartmentValueHelp: function (sMode) {
        var oDepartmentModel = this.getView().getModel("departmentLookupModel");
        var aDepartments =
          oDepartmentModel.getProperty("/allDepartments") || [];

        this._sDepartmentValueHelpMode = sMode || "dialog";

        var fnOpen = function () {
          oDepartmentModel.setProperty(
            "/departments",
            oDepartmentModel.getProperty("/allDepartments") || [],
          );

          this._openFragmentDialog(
            "pDepartmentDialog",
            "com.app.zu26g13.app.view.DepartmentValueHelp",
          );
        }.bind(this);

        if (aDepartments.length > 0) {
          fnOpen();
          return;
        }

        sap.ui.core.BusyIndicator.show(0);

        this._loadDepartmentLookup()
          .then(function () {
            sap.ui.core.BusyIndicator.hide();
            fnOpen();
          })
          .catch(function () {
            sap.ui.core.BusyIndicator.hide();

            MessageBox.error("Không thể lấy danh sách phòng ban.", {
              title: "Lỗi dữ liệu phòng ban",
            });
          });
      },

      onDepartmentValueHelpSearch: function (oEvent) {
        this._filterLookupModel(
          "departmentLookupModel",
          "/allDepartments",
          "/departments",
          oEvent.getParameter("value") || "",
          ["DeptId", "DeptName"],
        );
      },

      onDepartmentValueHelpConfirm: function (oEvent) {
        var oDepartment = this._getSelectedObject(
          oEvent,
          "departmentLookupModel",
        );

        if (!oDepartment) {
          this._resetDepartmentValueHelpList();
          return;
        }

        if (this._sDepartmentValueHelpMode === "headerDepartment") {
          var oHeaderModel = this.getView().getModel("headerSearchModel");
          var sDisplayText =
            (oDepartment.DeptName || "Phòng ban") +
            " (" +
            oDepartment.DeptId +
            ")";

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
        this._resetLookupList(
          "departmentLookupModel",
          "/allDepartments",
          "/departments",
        );
      },

      _openFragmentDialog: function (sPropertyName, sFragmentName) {
        var oView = this.getView();

        if (!this[sPropertyName]) {
          this[sPropertyName] = Fragment.load({
            id: oView.getId(),
            name: sFragmentName,
            controller: this,
          }).then(function (oDialog) {
            oView.addDependent(oDialog);
            return oDialog;
          });
        }

        this[sPropertyName].then(function (oDialog) {
          oDialog.open();
        });
      },

      _filterLookupModel: function (
        sModelName,
        sAllPath,
        sFilteredPath,
        sValue,
        aFields,
      ) {
        var oModel = this.getView().getModel(sModelName);
        var aAllItems = oModel.getProperty(sAllPath) || [];
        var sSearch = String(sValue || "")
          .toLowerCase()
          .trim();

        if (!sSearch) {
          oModel.setProperty(sFilteredPath, aAllItems);
          return;
        }

        var aFiltered = aAllItems.filter(function (item) {
          return aFields.some(function (sField) {
            return (
              String(item[sField] || "")
                .toLowerCase()
                .indexOf(sSearch) !== -1
            );
          });
        });

        oModel.setProperty(sFilteredPath, aFiltered);
      },

      _resetLookupList: function (sModelName, sAllPath, sFilteredPath) {
        var oModel = this.getView().getModel(sModelName);

        if (!oModel) {
          return;
        }

        oModel.setProperty(sFilteredPath, oModel.getProperty(sAllPath) || []);
      },

      _getSelectedObject: function (oEvent, sModelName) {
        var oSelectedItem = oEvent.getParameter("selectedItem");

        if (!oSelectedItem) {
          return null;
        }

        var oContext = oSelectedItem.getBindingContext(sModelName);

        return oContext ? oContext.getObject() : null;
      },

      onAssignModeChange: function (oEvent) {
        var sKey = oEvent.getParameter("key");
        var oItem = oEvent.getParameter("item");

        if (!sKey && oItem && oItem.getKey) {
          sKey = oItem.getKey();
        }

        sKey = sKey || "EMP";

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
        this.getView()
          .getModel("dialogModel")
          .setData(this._getDefaultDialogData());

        this._loadShiftLookup();
        this._openAddOtDialog();
      },

      _openEditDialog: function (oData) {
        if (this._isPastDate(oData.PlanDate)) {
          MessageBox.error(this._getPastDateMessage(oData.PlanDate), {
            title: "Không thể sửa lịch đã qua",
          });
          return;
        }

        this.getView()
          .getModel("dialogModel")
          .setData({
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
            sOtPath: oData.sOtPath,
          });

        this._loadShiftLookup();
        this._openAddOtDialog();
      },

      _openAddOtDialog: function () {
        this._openFragmentDialog(
          "pDialog",
          "com.app.zu26g13.app.view.AddOtDialog",
        );
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
        var bPastDate = this._isPastDate(oData.PlanDate);

        var sMessage =
          "Mã nhân viên: " +
          oData.Pernr +
          "\n" +
          "Tên nhân viên: " +
          (oData.EmployeeName || "") +
          "\n" +
          "Phòng ban: " +
          (oData.DeptName || oData.DeptId || "Không có") +
          "\n" +
          "Ngày làm việc: " +
          this._normalizeDate(oData.PlanDate).toLocaleDateString("vi-VN") +
          "\n" +
          "Ca: " +
          oData.ShiftId +
          "\n" +
          "Giờ làm: " +
          (oData.ShiftTimeText || "") +
          "\n" +
          "Số giờ OT: " +
          oData.OtHours +
          " tiếng\n";

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
          }.bind(this),
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
            title: "Dữ liệu OT không hợp lệ",
          });
          return;
        }

        if (!oDialogData.ShiftId) {
          MessageBox.error("Vui lòng chọn Ca làm việc.", {
            title: "Thiếu ca làm việc",
          });
          return;
        }

        sap.ui.core.BusyIndicator.show(0);

        if (oDialogData.isEdit) {
          this._handleEditSave(oODataModel, oDialogData, fOtHours);
          return;
        }

        if (oDialogData.AssignMode === "DEPT") {
          this._handleDepartmentCreate(oODataModel, oDialogData, fOtHours);
          return;
        }

        this._handleEmployeeCreate(
          oODataModel,
          oDialogModel,
          oDialogData,
          fOtHours,
        );
      },

      _handleEditSave: function (oODataModel, oDialogData, fOtHours) {
        if (!oDialogData.Pernr) {
          sap.ui.core.BusyIndicator.hide();
          MessageBox.error("Không xác định được nhân viên cần sửa.", {
            title: "Thiếu nhân viên",
          });
          return;
        }

        if (this._isPastDate(oDialogData.PlanDate)) {
          sap.ui.core.BusyIndicator.hide();
          MessageBox.error(this._getPastDateMessage(oDialogData.PlanDate), {
            title: "Không thể cập nhật lịch đã qua",
          });
          return;
        }

        this._saveEditSchedule(oODataModel, oDialogData, fOtHours);
      },

      _handleDepartmentCreate: function (oODataModel, oDialogData, fOtHours) {
        if (!oDialogData.DeptId) {
          sap.ui.core.BusyIndicator.hide();
          MessageBox.error("Vui lòng chọn phòng ban.", {
            title: "Thiếu phòng ban",
          });
          return;
        }

        this._getEmployeesByDepartment(oDialogData.DeptId)
          .then(
            function (aEmployees) {
              if (aEmployees.length === 0) {
                sap.ui.core.BusyIndicator.hide();
                MessageBox.error("Phòng ban này chưa có nhân viên.", {
                  title: "Không có nhân viên",
                });
                return;
              }

              this._saveCreateScheduleForEmployees(
                oODataModel,
                oDialogData,
                fOtHours,
                aEmployees,
              );
            }.bind(this),
          )
          .catch(
            function (oError) {
              sap.ui.core.BusyIndicator.hide();

              MessageBox.error(
                this._getODataErrorMessage(
                  oError,
                  "Không thể lấy danh sách nhân viên theo phòng ban.",
                ),
                {
                  title: "Lỗi dữ liệu phòng ban",
                },
              );
            }.bind(this),
          );
      },

      _handleEmployeeCreate: function (
        oODataModel,
        oDialogModel,
        oDialogData,
        fOtHours,
      ) {
        if (!oDialogData.Pernr) {
          sap.ui.core.BusyIndicator.hide();
          MessageBox.error("Vui lòng chọn nhân viên.", {
            title: "Thiếu nhân viên",
          });
          return;
        }

        this._ensureEmployeeExists(oDialogData.Pernr)
          .then(
            function (oEmployee) {
              oDialogData.Pernr = oEmployee.Pernr;

              oDialogModel.setProperty("/Pernr", oEmployee.Pernr);
              oDialogModel.setProperty(
                "/EmployeeName",
                oEmployee.EmployeeName || "",
              );
              oDialogModel.setProperty("/DeptId", oEmployee.DeptId || "");
              oDialogModel.setProperty("/DeptName", oEmployee.DeptName || "");

              this._saveCreateScheduleForEmployees(
                oODataModel,
                oDialogData,
                fOtHours,
                [oEmployee],
              );
            }.bind(this),
          )
          .catch(function (oError) {
            sap.ui.core.BusyIndicator.hide();

            MessageBox.error(
              oError && oError.message
                ? oError.message
                : "Mã nhân viên không tồn tại. Vui lòng chọn nhân viên từ search help.",
              {
                title: "Nhân viên không hợp lệ",
              },
            );
          });
      },

      _getEmployeesByDepartment: function (sDeptId) {
        return this._loadEmployeeLookup().then(
          function () {
            var aEmployees =
              this.getView()
                .getModel("employeeLookupModel")
                .getProperty("/allEmployees") || [];
            var sDept = String(sDeptId || "")
              .trim()
              .toUpperCase();

            return aEmployees.filter(function (item) {
              return (
                String(item.DeptId || "")
                  .trim()
                  .toUpperCase() === sDept
              );
            });
          }.bind(this),
        );
      },

      _saveCreateScheduleForEmployees: function (
        oODataModel,
        oDialogData,
        fOtHours,
        aEmployees,
      ) {
        var dStart = this._normalizeDate(oDialogData.StartDate);
        var dEnd = this._normalizeDate(oDialogData.EndDate);

        if (dStart > dEnd) {
          sap.ui.core.BusyIndicator.hide();

          MessageBox.error("Khoảng thời gian chọn không hợp lệ!", {
            title: "Sai khoảng ngày",
          });
          return;
        }

        if (this._isPastDate(dStart)) {
          sap.ui.core.BusyIndicator.hide();

          MessageBox.error(
            "Khoảng thời gian có ngày đã qua.\n\n" +
              "Từ ngày: " +
              dStart.toLocaleDateString("vi-VN") +
              "\n" +
              "Hôm nay: " +
              this._getTodayDateOnly().toLocaleDateString("vi-VN") +
              "\n\n" +
              "Vui lòng chọn ngày hôm nay hoặc ngày tương lai.",
            {
              title: "Không thể tạo lịch cho ngày đã qua",
            },
          );
          return;
        }

        var aDates = this._buildDateRange(dStart, dEnd);

        this._confirmNonWorkingDateStrategy(aDates)
          .then(
            function (aFinalDates) {
              if (!aFinalDates || aFinalDates.length === 0) {
                sap.ui.core.BusyIndicator.hide();
                return;
              }

              this._executeCreateScheduleForDates(
                oODataModel,
                oDialogData,
                fOtHours,
                aEmployees,
                aFinalDates,
              );
            }.bind(this),
          )
          .catch(
            function (oError) {
              sap.ui.core.BusyIndicator.hide();

              if (oError && oError.cancelled) {
                return;
              }

              MessageBox.error(
                this._getODataErrorMessage(
                  oError,
                  "Không thể kiểm tra ngày nghỉ/ngày lễ.",
                ),
                {
                  title: "Lỗi kiểm tra ngày nghỉ",
                },
              );
            }.bind(this),
          );
      },

      _confirmNonWorkingDateStrategy: function (aDates) {
        return this._getNonWorkingDates(aDates).then(
          function (aNonWorkingDates) {
            if (aNonWorkingDates.length === 0) {
              return aDates;
            }

            sap.ui.core.BusyIndicator.hide();

            var sDateList = aNonWorkingDates
              .map(function (item) {
                return "- " + item.DateText + ": " + item.Reason;
              })
              .join("\n");

            return new Promise(
              function (resolve, reject) {
                MessageBox.confirm(
                  "Khoảng thời gian bạn chọn có ngày Chủ nhật hoặc ngày lễ:\n\n" +
                    sDateList +
                    "\n\n" +
                    "Bạn có muốn tạo ca cho các ngày này không?",
                  {
                    title: "Xác nhận tạo ca ngày nghỉ",
                    actions: [
                      "Tạo cả ngày nghỉ",
                      "Bỏ qua ngày nghỉ",
                      MessageBox.Action.CANCEL,
                    ],
                    emphasizedAction: "Tạo cả ngày nghỉ",
                    onClose: function (sAction) {
                      if (sAction === MessageBox.Action.CANCEL) {
                        reject({
                          cancelled: true,
                        });
                        return;
                      }

                      if (sAction === "Tạo cả ngày nghỉ") {
                        sap.ui.core.BusyIndicator.show(0);
                        resolve(aDates);
                        return;
                      }

                      var mSkipDates = {};

                      aNonWorkingDates.forEach(function (item) {
                        mSkipDates[item.DateKey] = true;
                      });

                      var aFinalDates = aDates.filter(
                        function (dDate) {
                          return !mSkipDates[this._dateKey(dDate)];
                        }.bind(this),
                      );

                      if (aFinalDates.length === 0) {
                        MessageBox.error(
                          "Tất cả ngày trong khoảng chọn đều là Chủ nhật hoặc ngày lễ. Không có ngày thường để tạo ca.",
                          {
                            title: "Không có ngày hợp lệ",
                          },
                        );

                        reject({
                          cancelled: true,
                        });
                        return;
                      }

                      sap.ui.core.BusyIndicator.show(0);
                      resolve(aFinalDates);
                    }.bind(this),
                  },
                );
              }.bind(this),
            );
          }.bind(this),
        );
      },

      _executeCreateScheduleForDates: function (
        oODataModel,
        oDialogData,
        fOtHours,
        aEmployees,
        aDates,
      ) {
        var pChain = Promise.resolve();

        aEmployees.forEach(
          function (oEmployee) {
            aDates.forEach(
              function (dWorkDate) {
                pChain = pChain
                  .then(
                    function () {
                      if (this._isPastDate(dWorkDate)) {
                        return Promise.reject({
                          message: this._getPastDateMessage(dWorkDate),
                        });
                      }

                      return this._createEmpShiftIfNotExists(
                        oODataModel,
                        oEmployee.Pernr,
                        dWorkDate,
                        oDialogData.ShiftId,
                      );
                    }.bind(this),
                  )
                  .then(
                    function () {
                      if (fOtHours > 0) {
                        return this._upsertOtPlan(oODataModel, {
                          Pernr: oEmployee.Pernr,
                          PlanDate: this._toODataDate(dWorkDate),
                          ShiftId: oDialogData.ShiftId,
                          OtHours: fOtHours.toFixed(2),
                          IsOt: true,
                        });
                      }

                      return Promise.resolve();
                    }.bind(this),
                  );
              }.bind(this),
            );
          }.bind(this),
        );

        pChain
          .then(
            function () {
              sap.ui.core.BusyIndicator.hide();

              MessageBox.success("Đã thêm ca làm việc thành công!");
              this.onCloseAddDialog();
              this._loadCalendarData();
            }.bind(this),
          )
          .catch(
            function (oError) {
              sap.ui.core.BusyIndicator.hide();

              MessageBox.error(
                this._getODataErrorMessage(
                  oError,
                  "Có lỗi khi lưu ca làm việc hoặc OT.",
                ),
                {
                  title: "Không thể lưu lịch OT",
                },
              );
            }.bind(this),
          );
      },

      _saveEditSchedule: function (oODataModel, oDialogData, fOtHours) {
        var dWorkDate = this._normalizeDate(oDialogData.PlanDate);
        var dODataWorkDate = this._toODataDate(dWorkDate);

        if (this._isPastDate(dWorkDate)) {
          sap.ui.core.BusyIndicator.hide();

          MessageBox.error(this._getPastDateMessage(dWorkDate), {
            title: "Không thể cập nhật lịch đã qua",
          });
          return;
        }

        var pSaveShift = Promise.resolve();

        if (
          oDialogData.OldShiftId &&
          oDialogData.OldShiftId !== oDialogData.ShiftId
        ) {
          var sOldPath = this._buildEmpShiftPath(
            oODataModel,
            oDialogData.Pernr,
            dWorkDate,
            oDialogData.OldShiftId,
          );

          pSaveShift = this._deletePath(oODataModel, sOldPath, true).then(
            function () {
              return this._createEmpShift(oODataModel, {
                Pernr: oDialogData.Pernr,
                WorkDate: dODataWorkDate,
                ShiftId: oDialogData.ShiftId,
              });
            }.bind(this),
          );
        }

        pSaveShift
          .then(
            function () {
              if (fOtHours > 0) {
                return this._upsertOtPlan(oODataModel, {
                  Pernr: oDialogData.Pernr,
                  PlanDate: this._toODataDate(dWorkDate),
                  ShiftId: oDialogData.ShiftId,
                  OtHours: fOtHours.toFixed(2),
                  IsOt: true,
                });
              }

              return this._removeOtPlanByKey(
                oODataModel,
                oDialogData.Pernr,
                dWorkDate,
              );
            }.bind(this),
          )
          .then(
            function () {
              sap.ui.core.BusyIndicator.hide();

              MessageBox.success("Đã cập nhật ca làm việc thành công!");
              this.onCloseAddDialog();
              this._loadCalendarData();
            }.bind(this),
          )
          .catch(
            function (oError) {
              sap.ui.core.BusyIndicator.hide();

              MessageBox.error(
                this._getODataErrorMessage(
                  oError,
                  "Có lỗi khi cập nhật ca làm việc.",
                ),
                {
                  title: "Không thể cập nhật lịch OT",
                },
              );
            }.bind(this),
          );
      },

      _deleteSchedule: function (oData) {
        if (this._isPastDate(oData.WorkDate || oData.PlanDate)) {
          MessageBox.error(
            this._getPastDateMessage(oData.WorkDate || oData.PlanDate),
            {
              title: "Không thể xóa lịch đã qua",
            },
          );
          return;
        }

        var oODataModel = this.getView().getModel();

        sap.ui.core.BusyIndicator.show(0);

        var pDeleteShift = Promise.resolve();

        if (oData.Pernr && oData.WorkDate && oData.ShiftId) {
          pDeleteShift = this._deletePath(
            oODataModel,
            this._buildEmpShiftPath(
              oODataModel,
              oData.Pernr,
              oData.WorkDate,
              oData.ShiftId,
            ),
            false,
          );
        }

        pDeleteShift
          .then(
            function () {
              return this._readEmpShiftByDate(
                oODataModel,
                oData.Pernr,
                oData.WorkDate,
              );
            }.bind(this),
          )
          .then(
            function (aRemaining) {
              if (aRemaining.length === 0) {
                return this._removeOtPlanByKey(
                  oODataModel,
                  oData.Pernr,
                  oData.WorkDate || oData.PlanDate,
                );
              }

              return Promise.resolve();
            }.bind(this),
          )
          .then(
            function () {
              sap.ui.core.BusyIndicator.hide();

              MessageBox.success("Đã xóa ca làm việc thành công!");
              this._loadCalendarData();
            }.bind(this),
          )
          .catch(
            function (oError) {
              sap.ui.core.BusyIndicator.hide();

              MessageBox.error(
                this._getODataErrorMessage(
                  oError,
                  "Có lỗi xảy ra khi xóa ca làm việc.",
                ),
                {
                  title: "Không thể xóa lịch làm việc",
                },
              );
            }.bind(this),
          );
      },

      _readSet: function (sPath, mParameters) {
        var oODataModel = this.getView().getModel();

        return new Promise(function (resolve, reject) {
          oODataModel.read(
            sPath,
            Object.assign(
              {
                success: function (oData) {
                  resolve(oData.results || []);
                },
                error: function (oError) {
                  reject(oError);
                },
              },
              mParameters || {},
            ),
          );
        });
      },

      _createEmpShiftIfNotExists: function (
        oODataModel,
        sPernr,
        dWorkDate,
        sShiftId,
      ) {
        return this._readEmpShiftByDate(oODataModel, sPernr, dWorkDate).then(
          function (aExisting) {
            if (aExisting.length > 0) {
              return Promise.reject({
                message:
                  "Nhân viên " +
                  sPernr +
                  " đã có ca " +
                  (aExisting[0].ShiftId || "") +
                  " trong ngày " +
                  this._normalizeDate(dWorkDate).toLocaleDateString("vi-VN") +
                  ". Vui lòng chỉnh sửa ca hiện có thay vì tạo thêm.",
              });
            }

            return this._createEmpShift(oODataModel, {
              Pernr: sPernr,
              WorkDate: this._toODataDate(dWorkDate),
              ShiftId: sShiftId,
            });
          }.bind(this),
        );
      },

      _readEmpShiftByDate: function (oODataModel, sPernr, dWorkDate) {
        return new Promise(
          function (resolve, reject) {
            oODataModel.read("/EmpShift", {
              filters: [
                new Filter("Pernr", FilterOperator.EQ, sPernr),
                new Filter(
                  "WorkDate",
                  FilterOperator.EQ,
                  this._toODataDate(dWorkDate),
                ),
              ],
              success: function (oData) {
                resolve(oData.results || []);
              },
              error: function (oError) {
                reject(oError);
              },
            });
          }.bind(this),
        );
      },

      _createEmpShift: function (oODataModel, oPayload) {
        return new Promise(function (resolve, reject) {
          oODataModel.create("/EmpShift", oPayload, {
            success: function () {
              resolve();
            },
            error: function (oError) {
              reject(oError);
            },
          });
        });
      },

      _readOtPlanByDate: function (oODataModel, sPernr, dPlanDate) {
        return new Promise(
          function (resolve, reject) {
            oODataModel.read("/OtPlan", {
              filters: [
                new Filter("Pernr", FilterOperator.EQ, sPernr),
                new Filter(
                  "PlanDate",
                  FilterOperator.EQ,
                  this._toODataDate(dPlanDate),
                ),
              ],
              success: function (oData) {
                resolve(oData.results || []);
              },
              error: function (oError) {
                reject(oError);
              },
            });
          }.bind(this),
        );
      },

      _upsertOtPlan: function (oODataModel, oPayload) {
        return this._readOtPlanByDate(
          oODataModel,
          oPayload.Pernr,
          oPayload.PlanDate,
        ).then(
          function (aOtPlan) {
            if (aOtPlan && aOtPlan.length > 0) {
              var oExistingOt = aOtPlan[0];

              var sUpdatePath = oODataModel.createKey("/OtPlan", {
                Pernr: oExistingOt.Pernr || oPayload.Pernr,
                PlanDate: this._toODataDate(
                  this._toDate(oExistingOt.PlanDate || oPayload.PlanDate),
                ),
              });

              var oUpdatePayload = {
                ShiftId: oPayload.ShiftId,
                OtHours: oPayload.OtHours,
                IsOt: oPayload.IsOt,
              };

              return new Promise(function (resolve, reject) {
                oODataModel.update(sUpdatePath, oUpdatePayload, {
                  success: function () {
                    resolve();
                  },
                  error: function (oError) {
                    reject(oError);
                  },
                });
              });
            }

            var oCreatePayload = {
              Pernr: oPayload.Pernr,
              PlanDate: this._toODataDate(oPayload.PlanDate),
              ShiftId: oPayload.ShiftId,
              OtHours: oPayload.OtHours,
              IsOt: oPayload.IsOt,
            };

            return new Promise(function (resolve, reject) {
              oODataModel.create("/OtPlan", oCreatePayload, {
                success: function () {
                  resolve();
                },
                error: function (oError) {
                  reject(oError);
                },
              });
            });
          }.bind(this),
        );
      },

      _removeOtPlanByKey: function (oODataModel, sPernr, dPlanDate) {
        return this._readOtPlanByDate(oODataModel, sPernr, dPlanDate).then(
          function (aOtPlan) {
            if (!aOtPlan || aOtPlan.length === 0) {
              return Promise.resolve();
            }

            var oOtPlan = aOtPlan[0];

            var sPath = oODataModel.createKey("/OtPlan", {
              Pernr: oOtPlan.Pernr || sPernr,
              PlanDate: this._toODataDate(
                this._toDate(oOtPlan.PlanDate || dPlanDate),
              ),
            });

            return this._deletePath(oODataModel, sPath, true);
          }.bind(this),
        );
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
            },
          });
        });
      },

      _ensureEmployeeExists: function (sPernr) {
        var oEmployee = this._findEmployeeByPernr(sPernr);

        if (oEmployee) {
          return Promise.resolve(oEmployee);
        }

        return this._loadEmployeeLookup().then(
          function () {
            var oFound = this._findEmployeeByPernr(sPernr);

            if (oFound) {
              return oFound;
            }

            return Promise.reject({
              message:
                "Mã nhân viên " +
                sPernr +
                " không tồn tại trong danh sách nhân viên. Vui lòng chọn bằng search help.",
            });
          }.bind(this),
        );
      },

      _findEmployeeByPernr: function (sPernr) {
        var oEmployeeModel = this.getView().getModel("employeeLookupModel");
        var aEmployees = oEmployeeModel
          ? oEmployeeModel.getProperty("/allEmployees") || []
          : [];
        var sInput = this._normalizePernrForCompare(sPernr);

        for (var i = 0; i < aEmployees.length; i++) {
          if (this._normalizePernrForCompare(aEmployees[i].Pernr) === sInput) {
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

      _getNonWorkingDates: function (aDates) {
        return this._loadHolidayMap().then(
          function (mHolidayMap) {
            var aResult = [];

            aDates.forEach(
              function (dDate) {
                var sDateKey = this._dateKey(dDate);
                var aReasons = [];

                if (this._isSunday(dDate)) {
                  aReasons.push("Chủ nhật");
                }

                if (mHolidayMap[sDateKey]) {
                  aReasons.push("Ngày lễ: " + mHolidayMap[sDateKey]);
                }

                if (aReasons.length > 0) {
                  aResult.push({
                    Date: dDate,
                    DateKey: sDateKey,
                    DateText: dDate.toLocaleDateString("vi-VN"),
                    Reason: aReasons.join(", "),
                  });
                }
              }.bind(this),
            );

            return aResult;
          }.bind(this),
        );
      },

      _loadHolidayMap: function () {
        return this._readSet("/Holiday")
          .then(
            function (aHolidays) {
              var mHolidayMap = {};

              aHolidays.forEach(
                function (item) {
                  var dHolDate = this._toDate(item.HolDate);
                  var sDateKey = this._dateKey(dHolDate);

                  mHolidayMap[sDateKey] = item.HolDesc || "Ngày lễ";
                }.bind(this),
              );

              return mHolidayMap;
            }.bind(this),
          )
          .catch(function () {
            return {};
          });
      },

      _isSunday: function (vDate) {
        return this._normalizeDate(vDate).getDay() === 0;
      },

      _buildDateRange: function (dStart, dEnd) {
        var aDates = [];
        var dCurrent = new Date(dStart);

        while (dCurrent <= dEnd) {
          aDates.push(this._normalizeDate(dCurrent));
          dCurrent.setDate(dCurrent.getDate() + 1);
        }

        return aDates;
      },

      _getTodayDateOnly: function () {
        var dToday = new Date();
        dToday.setHours(0, 0, 0, 0);
        return dToday;
      },

      _isPastDate: function (vDate) {
        return this._normalizeDate(vDate) < this._getTodayDateOnly();
      },

      _getPastDateMessage: function (vDate) {
        return (
          "Ngày " +
          this._normalizeDate(vDate).toLocaleDateString("vi-VN") +
          " đã qua. Không được thêm, sửa hoặc xóa lịch làm việc cho ngày đã qua."
        );
      },

      _toODataDate: function (vDate) {
        var dDate = this._normalizeDate(vDate);

        return new Date(
          Date.UTC(
            dDate.getFullYear(),
            dDate.getMonth(),
            dDate.getDate(),
            0,
            0,
            0,
          ),
        );
      },

      _buildEmpShiftPath: function (oODataModel, sPernr, vWorkDate, sShiftId) {
        return oODataModel.createKey("/EmpShift", {
          Pernr: sPernr,
          WorkDate: this._toODataDate(vWorkDate),
          ShiftId: sShiftId,
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
          return new Date(parseInt(vDate.replace(/\D/g, ""), 10));
        }

        return new Date(vDate);
      },

      _dateKey: function (vDate) {
        var dDate = this._normalizeDate(vDate);

        return (
          dDate.getFullYear() +
          "-" +
          String(dDate.getMonth() + 1).padStart(2, "0") +
          "-" +
          String(dDate.getDate()).padStart(2, "0")
        );
      },

      _getHoursMinutes: function (vTime) {
        if (!vTime) {
          return {
            hours: 0,
            minutes: 0,
          };
        }

        if (typeof vTime === "object" && vTime.ms !== undefined) {
          var iTotalSeconds = Math.floor(vTime.ms / 1000);

          return {
            hours: Math.floor(iTotalSeconds / 3600),
            minutes: Math.floor((iTotalSeconds % 3600) / 60),
          };
        }

        var sTime = String(vTime);
        var aMatch = sTime.match(/^PT(\d+)H(\d+)M/);

        if (aMatch) {
          return {
            hours: parseInt(aMatch[1], 10),
            minutes: parseInt(aMatch[2], 10),
          };
        }

        if (/^\d{6}$/.test(sTime)) {
          return {
            hours: parseInt(sTime.substring(0, 2), 10),
            minutes: parseInt(sTime.substring(2, 4), 10),
          };
        }

        if (/^\d{2}:\d{2}:\d{2}$/.test(sTime)) {
          return {
            hours: parseInt(sTime.substring(0, 2), 10),
            minutes: parseInt(sTime.substring(3, 5), 10),
          };
        }

        return {
          hours: 0,
          minutes: 0,
        };
      },

      _formatTime: function (vTime) {
        var oTime = this._getHoursMinutes(vTime);

        return (
          String(oTime.hours).padStart(2, "0") +
          ":" +
          String(oTime.minutes).padStart(2, "0")
        );
      },

      formatAppointmentType: function (sShiftId, sOtHours) {
        var fOt = parseFloat(sOtHours || "0");
        var sShift = String(sShiftId || "").toUpperCase();

        if (fOt > 0) {
          return sap.ui.unified.CalendarDayType.Type01;
        }

        if (sShift === "CA_01") {
          return sap.ui.unified.CalendarDayType.Type08;
        }

        if (sShift === "CA_02") {
          return sap.ui.unified.CalendarDayType.Type06;
        }

        if (sShift === "CA_03") {
          return sap.ui.unified.CalendarDayType.Type07;
        }

        return sap.ui.unified.CalendarDayType.Type09;
      },

      _getODataErrorMessage: function (oError, sDefaultMessage) {
        var aMessages = [];

        var fnAddMessage = function (sMessage) {
          sMessage = String(sMessage || "").trim();

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

        return aMessages.length > 0
          ? aMessages.join("\n")
          : sDefaultMessage || "Có lỗi xảy ra.";
      },
    });
  },
);
