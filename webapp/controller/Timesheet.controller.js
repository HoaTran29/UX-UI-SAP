sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment",
    "sap/m/MessageBox",
  ],
  function (
    Controller,
    Filter,
    FilterOperator,
    MessageToast,
    Fragment,
    MessageBox,
  ) {
    "use strict";

    return Controller.extend("com.app.zu26g13.app.controller.Timesheet", {
      onInit: function () {
        var oRouter = this.getOwnerComponent().getRouter();
        oRouter
          .getRoute("timesheet")
          .attachPatternMatched(this._onRouteMatched, this);
      },

      _onRouteMatched: function () {
        var oDatePicker = this.byId("fltDate");
        var oToday = new Date();
        oDatePicker.setDateValue(oToday);
        this.onSearch();
      },

      // =========================================================
      // HELPER FUNCTIONS
      // =========================================================

      // Retrieve text from i18n
      _getI18nText: function (sKey) {
        return this.getView()
          .getModel("i18n")
          .getResourceBundle()
          .getText(sKey);
      },

      // =========================================================
      // FILTERING & NAVIGATION
      // =========================================================

      onSearch: function () {
        var aFilters = [];
        var oDate = this.byId("fltDate").getDateValue();
        var sEmp = this.byId("fltEmp").getValue();

        if (oDate) {
          var y = oDate.getFullYear();
          var m = oDate.getMonth();
          var d = oDate.getDate();

          var dStart = new Date(Date.UTC(y, m, d, 0, 0, 0));
          var dEnd = new Date(Date.UTC(y, m, d, 23, 59, 59));

          aFilters.push(
            new Filter("WorkDate", FilterOperator.BT, dStart, dEnd),
          );
        }

        if (sEmp) {
          aFilters.push(new Filter("Pernr", FilterOperator.EQ, sEmp));
        }

        var oTable = this.byId("dailyTimesheetTable");
        oTable.getBinding("items").filter(aFilters);
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
      // EDIT TIMESHEET DIALOG & SAVING LOGIC
      // =========================================================

      // 1. Open Edit Dialog
      onEditTimesheet: function (oEvent) {
        var oView = this.getView();
        var oContext = oEvent.getSource().getBindingContext();

        // Create a deep copy of data to prevent live-updating the table outside before saving
        var oRowData = JSON.parse(JSON.stringify(oContext.getObject()));
        var oDialogModel = new sap.ui.model.json.JSONModel(oRowData);

        if (!this._pEditDialog) {
          this._pEditDialog = Fragment.load({
            id: oView.getId(),
            name: "com.app.zu26g13.app.view.EditTimesheetDialog",
            controller: this,
          }).then(function (oDialog) {
            oView.addDependent(oDialog);
            return oDialog;
          });
        }

        this._pEditDialog.then(function (oDialog) {
          // Bind local JSON model to the dialog
          oDialog.setModel(oDialogModel);
          oDialog.bindElement("/");

          // Store original OData path for saving later
          oDialog.data("originalPath", oContext.getPath());

          oDialog.open();
        });
      },

      // 2. Save Timesheet with Validations (Shields)
      onSaveTimesheet: function () {
        var oView = this.getView();
        var oODataModel = oView.getModel();
        var oDialog = this.byId("editTimesheetDialog");

        var oData = oDialog.getModel().getData();
        var sPath = oDialog.data("originalPath");

        // Extract original data from OData Model for comparison
        var oOriginalData = oODataModel.getProperty(sPath);

        // --- 1. Normalize Work Date for Validation ---
        var dWorkDate = oData.WorkDate;
        if (
          typeof dWorkDate === "string" &&
          dWorkDate.indexOf("/Date(") === 0
        ) {
          var iTime = parseInt(dWorkDate.replace(/\D/g, ""), 10);
          dWorkDate = new Date(iTime);
        } else if (!(dWorkDate instanceof Date)) {
          dWorkDate = new Date(dWorkDate);
        }
        var dODataWorkDate = new Date(
          Date.UTC(
            dWorkDate.getFullYear(),
            dWorkDate.getMonth(),
            dWorkDate.getDate(),
            0,
            0,
            0,
          ),
        );

        // Setup current date at 00:00:00 to check for ongoing shifts
        var dToday = new Date();
        dToday.setHours(0, 0, 0, 0);

        // --- 2. Time Extraction Helper ---
        var getSecondsFromTime = function (t) {
          if (!t) return 0;
          var h = 0,
            m = 0,
            s = 0;
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
        var iOldInSec = oOriginalData
          ? getSecondsFromTime(oOriginalData.ActIn)
          : 0;
        var iOldOutSec = oOriginalData
          ? getSecondsFromTime(oOriginalData.ActOut)
          : 0;

        // ==========================================================
        // FRONT-END VALIDATIONS (SHIELDS)
        // ==========================================================

        // Shield 1: Check-in time is mandatory
        if (iNewInSec === 0) {
          MessageBox.error(this._getI18nText("msgMissingCheckIn"));
          return;
        }

        // Shield 2: Block manual check-out if shift is today and ongoing
        if (
          dWorkDate.getTime() === dToday.getTime() &&
          iOldOutSec === 0 &&
          iNewOutSec > 0
        ) {
          MessageBox.error(this._getI18nText("msgShiftOngoing"));
          return;
        }

        // Shield 3: Prevent entering an earlier check-in than originally recorded
        if (iOldInSec > 0 && iNewInSec < iOldInSec) {
          MessageBox.error(this._getI18nText("msgEarlyCheckIn"));
          return;
        }

        // Shield 4: Prevent entering a later check-out than originally recorded (OT abuse prevention)
        if (iOldOutSec > 0 && iNewOutSec > iOldOutSec) {
          MessageBox.error(this._getI18nText("msgLateCheckOut"));
          return;
        }

        // Shield 5: Logical validations for complete shifts
        if (iNewInSec > 0 && iNewOutSec > 0) {
          var iDiff = iNewOutSec - iNewInSec;
          if (iDiff < 0) {
            iDiff += 24 * 3600;
          } // Handle overnight shifts

          if (iDiff === 0) {
            MessageBox.error(this._getI18nText("msgIdenticalTimes"));
            return;
          }
          if (iDiff > 16 * 3600) {
            MessageBox.error(this._getI18nText("msgExceed16Hours"));
            return;
          }
        }

        // ==========================================================
        // VALIDATION PASSED -> PREPARE ODATA PAYLOAD
        // ==========================================================

        var formatToODataTime = function (sTime) {
          if (!sTime) return null; // Allow null for ongoing shifts
          var s = getSecondsFromTime(sTime);
          return { ms: s * 1000, __edmType: "Edm.Time" };
        };

        var sOtHours = oData.OtHours
          ? parseFloat(oData.OtHours).toString()
          : "0.00";
        var sWorkHours = oData.WorkHours
          ? parseFloat(oData.WorkHours).toString()
          : "0.00";
        var sShiftId =
          oData.ShiftId || (oOriginalData ? oOriginalData.ShiftId : "");
        var sSeqNo =
          oData.SeqNo || (oOriginalData ? oOriginalData.SeqNo : "01");
        var oPayload = {
          SeqNo: sSeqNo,
          Pernr: oData.Pernr,
          WorkDate: dODataWorkDate,
          ShiftId: sShiftId,
          DeptId: oData.DeptId || "",
          ActIn: formatToODataTime(oData.ActIn),
          ActOut: formatToODataTime(oData.ActOut),
          WorkHours: sWorkHours,
          OtHours: sOtHours,
          Status: oData.Status || "COMPLETED",
        };

        var sNewPath = oODataModel.createKey("/Timesheet", {
          SeqNo: sSeqNo,
          Pernr: oData.Pernr,
          WorkDate: dODataWorkDate,
          ShiftId: sShiftId,
        });

        oDialog.setBusy(true);

        // Execute Update Request
        oODataModel.update(sNewPath, oPayload, {
          success: function () {
            oDialog.setBusy(false);
            MessageToast.show(this._getI18nText("msgTimesheetUpdated"));
            oDialog.close();
            oODataModel.refresh(true);
          }.bind(this),
          error: function (oError) {
            oDialog.setBusy(false);

            // Hiển thị thông báo lỗi chi tiết từ Backend nếu có
            var sErrorMsg = this._getI18nText("msgUpdateTimesheetError");
            try {
              var oResponseBody = JSON.parse(oError.responseText);
              if (
                oResponseBody &&
                oResponseBody.error &&
                oResponseBody.error.message
              ) {
                sErrorMsg = oResponseBody.error.message.value;
              }
            } catch (e) { }

            MessageBox.error(sErrorMsg);
          }.bind(this),
        });
      },

      onCancelTimesheet: function () {
        var oDialog = this.byId("editTimesheetDialog");
        if (oDialog) {
          oDialog.close();
        }
      },

      // =========================================================
      // FORMATTERS
      // =========================================================

      formatStatusText: function (sStatus, dWorkDate) {
        if (!sStatus) {
          return "";
        }
        return sStatus;
      },

      formatStatusState: function (sStatus, dWorkDate) {
        if (!dWorkDate) {
          return "None";
        }

        var oToday = new Date();
        oToday.setHours(0, 0, 0, 0);
        var oWork = new Date(dWorkDate);
        oWork.setHours(0, 0, 0, 0);

        // Future date logic (Neutral gray or blue info state)
        if (oWork > oToday) {
          return "None";
        }

        // Map backend status to UI color states
        if (sStatus === "ABSENT") return "Warning"; // Yellow
        if (sStatus === "COMPLETED") return "Success"; // Green
        if (sStatus === "WARNING") return "Error"; // Red
        if (sStatus === "LEAVE") return "Information"; // Blue
        return "None";
      },

      formatTimeDisplay: function (oTime, dWorkDate) {
        var oToday = new Date();
        oToday.setHours(0, 0, 0, 0);
        var oWork = new Date(dWorkDate);
        oWork.setHours(0, 0, 0, 0);

        // Display "00:00" for future dates or empty times instead of "12:00:00 AM"
        if (
          oWork > oToday ||
          !oTime ||
          oTime.ms === 0 ||
          oTime === "PT00H00M00S"
        ) {
          return "00:00:00";
        }

        // Format actual time to 24-hour layout (HH:mm:ss)
        var timeFormat = sap.ui.core.format.DateFormat.getTimeInstance({
          pattern: "HH:mm:ss",
          UTC: true,
        });
        return timeFormat.format(new Date(oTime.ms));
      },

      // ==========================================================
      // EMPLOYEE VALUE HELP (POPOVER)
      // ==========================================================

      onEmployeeValueHelpRequest: function (oEvent) {
        var oView = this.getView();
        // Anchor point for Popover
        this._oInputEmp = oEvent.getSource();

        if (!this._pEmpValueHelpDialog) {
          this._pEmpValueHelpDialog = Fragment.load({
            id: oView.getId(),
            name: "com.app.zu26g13.app.view.EmployeeValueHelp",
            controller: this,
          }).then(function (oPopover) {
            oView.addDependent(oPopover);
            return oPopover;
          });
        }

        this._pEmpValueHelpDialog.then(
          function (oPopover) {
            var oList = this.byId("empValueHelpList");
            if (oList) {
              oList.getBinding("items").filter([]);
            }

            oPopover.openBy(this._oInputEmp);
          }.bind(this),
        );
      },

      onEmployeeValueHelpSearch: function (oEvent) {
        var sValue =
          oEvent.getParameter("value") || oEvent.getParameter("newValue");

        var oFilterName = new Filter("Ename", FilterOperator.Contains, sValue);
        var oFilterId = new Filter("Pernr", FilterOperator.EQ, sValue);

        var oCombinedFilter = new Filter({
          filters: [oFilterName, oFilterId],
          and: false,
        });

        this.byId("empValueHelpList")
          .getBinding("items")
          .filter([oCombinedFilter]);
      },

      onEmployeeValueHelpConfirm: function (oEvent) {
        var oSelectedItem = oEvent.getParameter("listItem");
        if (oSelectedItem) {
          var sEmpId = oSelectedItem.getDescription();
          this._oInputEmp.setValue(sEmpId);

          if (this.onSearch) {
            this.onSearch();
          }
        }

        if (this._pEmpValueHelpDialog) {
          this._pEmpValueHelpDialog.then(function (oPopover) {
            oPopover.close();
          });
        }
      },

      onEmployeeValueHelpCancel: function () {
        if (this._pEmpValueHelpDialog) {
          this._pEmpValueHelpDialog.then(function (oPopover) {
            oPopover.close();
          });
        }
      },
      // =========================================================
      // PUNCH LOG DIALOG LOGIC
      // =========================================================
      onOpenPunchLog: function (oEvent) {
        var oButton = oEvent.getSource();
        var oContext = oButton.getBindingContext();
        var oRowData = oContext.getObject();

        var oView = this.getView();

        if (!this._pPunchLogDialog) {
          this._pPunchLogDialog = sap.ui.core.Fragment.load({
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

          var oTable = this.byId("punchLogTable");
          var oBinding = oTable.getBinding("items");

          var aFilters = [
            new sap.ui.model.Filter("Pernr", sap.ui.model.FilterOperator.EQ, oRowData.Pernr),
            new sap.ui.model.Filter("ShiftId", sap.ui.model.FilterOperator.EQ, oRowData.ShiftId)
          ];

          if (oRowData.WorkDate) {
            var dDate = new Date(oRowData.WorkDate);
            var dODataDateStart = new Date(Date.UTC(dDate.getFullYear(), dDate.getMonth(), dDate.getDate(), 0, 0, 0));
            var dODataDateEnd = new Date(Date.UTC(dDate.getFullYear(), dDate.getMonth(), dDate.getDate() + 1, 23, 59, 59));
            aFilters.push(new sap.ui.model.Filter("PunchDate", sap.ui.model.FilterOperator.BT, dODataDateStart, dODataDateEnd));
          }

          oBinding.filter(aFilters);
          oDialog.open();
        }.bind(this));
      },

      onClosePunchLogDialog: function () {
        if (this._pPunchLogDialog) {
          this._pPunchLogDialog.then(function (oDialog) {
            oDialog.close();
          });
        }
      }
    });
  },
);
