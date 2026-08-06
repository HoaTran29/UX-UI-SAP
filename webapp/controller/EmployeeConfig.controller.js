sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/Fragment",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/BusyIndicator"
], function (Controller, Fragment, Filter, FilterOperator, MessageToast, MessageBox, JSONModel, BusyIndicator) {
    "use strict";

    return Controller.extend("com.app.zu26g13.app.controller.EmployeeConfig", {
        
        onInit: function () {
            // Auto-reload data when routing to this page
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("employeeConfig").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function () {
            var oTable = this.byId("employeeTable");
            if (oTable && oTable.getBinding("items")) {
                oTable.getBinding("items").refresh();
            }
        },

        // =========================================================
        // FILTER BAR LOGIC
        // =========================================================
        onSearch: function () {
            var sPernr = this.byId("filterPernr").getValue();
            var sDept = this.byId("filterDept").getValue();
            var aFilters = [];

            if (sPernr) {
                aFilters.push(new Filter("Pernr", FilterOperator.Contains, sPernr));
            }
            if (sDept) {
                aFilters.push(new Filter("DeptId", FilterOperator.Contains, sDept));
            }

            var oTable = this.byId("employeeTable");
            if (oTable && oTable.getBinding("items")) {
                oTable.getBinding("items").filter(aFilters);
            }
        },

        onClearFilters: function () {
            this.byId("filterPernr").setValue("");
            this.byId("filterDept").setValue("");
            
            var oTable = this.byId("employeeTable");
            if (oTable && oTable.getBinding("items")) {
                oTable.getBinding("items").filter([]);
            }
        },

        // =========================================================
        // EMPLOYEE VALUE HELP (POPOVER)
        // =========================================================
        onPernrInputValueHelpRequest: function (oEvent) {
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
                if (oList) {
                    oList.getBinding("items").filter([]); // Clear previous search
                    oList.removeSelections(true);         // Clear green selection
                }
                oPopover.openBy(this._oInputEmp);
            }.bind(this));
        },

        onEmployeeValueHelpSearch: function (oEvent) {
            var sValue = oEvent.getParameter("value") || oEvent.getParameter("newValue");
            var oFilterName = new Filter("Ename", FilterOperator.Contains, sValue);
            var oFilterId = new Filter("Pernr", FilterOperator.Contains, sValue);
            var oCombinedFilter = new Filter({ filters: [oFilterName, oFilterId], and: false });

            this.byId("empValueHelpList").getBinding("items").filter([oCombinedFilter]);
        },

        onEmployeeValueHelpConfirm: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("listItem");
            if (oSelectedItem && this._oInputEmp) {
                this._oInputEmp.setValue(oSelectedItem.getDescription()); // description is Pernr
                if (this.onSearch) { this.onSearch(); }
                this._pEmpValueHelpDialog.then(function (oPopover) { oPopover.close(); });
            }
        },

        onEmployeeValueHelpCancel: function () {
            if (this._pEmpValueHelpDialog) {
                this._pEmpValueHelpDialog.then(function (oPopover) { oPopover.close(); });
            }
        },

        // =========================================================
        // DEPARTMENT VALUE HELP (POPOVER)
        // =========================================================
        onDeptInputValueHelpRequest: function (oEvent) {
            var oView = this.getView();
            this._oInputDept = oEvent.getSource();

            if (!this._pDeptValueHelpDialog) {
                this._pDeptValueHelpDialog = Fragment.load({
                    id: oView.getId(),
                    name: "com.app.zu26g13.app.view.DepartmentValueHelp",
                    controller: this
                }).then(function (oPopover) {
                    oView.addDependent(oPopover);
                    return oPopover;
                });
            }
            this._pDeptValueHelpDialog.then(function (oPopover) {
                var oList = this.byId("deptValueHelpList");
                if (oList) {
                    oList.getBinding("items").filter([]); // Clear previous search
                    oList.removeSelections(true);         // Clear green selection
                }
                oPopover.openBy(this._oInputDept);
            }.bind(this));
        },

        onDeptValueHelpSearch: function (oEvent) {
            var sValue = oEvent.getParameter("value") || oEvent.getParameter("newValue");
            var oFilterName = new Filter("DeptName", FilterOperator.Contains, sValue);
            var oFilterId = new Filter("DeptId", FilterOperator.Contains, sValue);
            var oCombinedFilter = new Filter({ filters: [oFilterName, oFilterId], and: false });

            this.byId("deptValueHelpList").getBinding("items").filter([oCombinedFilter]);
        },

        onDeptValueHelpConfirm: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("listItem");
            if (oSelectedItem && this._oInputDept) {
                this._oInputDept.setValue(oSelectedItem.getDescription()); // description is DeptId
                if (this.onSearch) { this.onSearch(); }
                this._pDeptValueHelpDialog.then(function (oPopover) { oPopover.close(); });
            }
        },

        onDeptValueHelpCancel: function () {
            if (this._pDeptValueHelpDialog) {
                this._pDeptValueHelpDialog.then(function (oPopover) { oPopover.close(); });
            }
        },

        // =========================================================
        // CRUD OPERATIONS (CREATE, EDIT, DELETE)
        // =========================================================
        
        onOpenCreateDialog: function () {
            var oView = this.getView();
            this._sAction = "CREATE";

            if (!this._pDialog) {
                this._pDialog = Fragment.load({
                    id: oView.getId(),
                    name: "com.app.zu26g13.app.view.EmployeeDialog",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }

            this._pDialog.then(function (oDialog) {
                // Clear input fields for Create mode
                oView.byId("inputPernr").setValue("").setEditable(true);
                oView.byId("inputEname").setValue("");
                oView.byId("inputCardId").setValue("").setEditable(true);
                oView.byId("selectDept").setSelectedKey("");
                oView.byId("selectRole").setSelectedKey("");

                oDialog.setTitle("Create New Employee");
                oDialog.open();
            });
        },

        onOpenEditDialog: function (oEvent) {
            var oView = this.getView();
            this._sAction = "EDIT"; 

            // Get selected row data
            var oContext = oEvent.getSource().getBindingContext();
            var oRowData = oContext.getObject();

            if (!this._pDialog) {
                this._pDialog = Fragment.load({
                    id: oView.getId(),
                    name: "com.app.zu26g13.app.view.EmployeeDialog",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }

            this._pDialog.then(function (oDialog) {
                // Bind existing data to fields (Disable key fields)
                oView.byId("inputPernr").setValue(oRowData.Pernr).setEditable(false); 
                oView.byId("inputEname").setValue(oRowData.Ename);
                oView.byId("inputCardId").setValue(oRowData.CardId).setEditable(false);
                oView.byId("selectDept").setSelectedKey(oRowData.DeptId);
                oView.byId("selectRole").setSelectedKey(oRowData.RoleId);

                oDialog.setTitle("Edit Employee Information");
                oDialog.open();
            });
        },

        onDeleteEmployee: function (oEvent) {
            var oModel = this.getView().getModel(); 
            var oContext = oEvent.getSource().getBindingContext();
            var oRowData = oContext.getObject();
            var sPath = oContext.getPath(); 

            MessageBox.confirm(
                "Are you sure you want to delete employee " + oRowData.Ename + " (ID: " + oRowData.Pernr + ")?",
                {
                    title: "Confirm Deletion",
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    emphasizedAction: MessageBox.Action.YES,
                    onClose: function (oAction) {
                        if (oAction === MessageBox.Action.YES) {
                            this.getView().setBusy(true);

                            // Trigger DELETE to SAP Backend
                            oModel.remove(sPath, {
                                success: function () {
                                    this.getView().setBusy(false);
                                    oModel.refresh(true); // Refresh table data
                                    MessageToast.show("Employee deleted successfully!");
                                }.bind(this),
                                error: function (oError) {
                                    this.getView().setBusy(false);
                                    MessageBox.error("System error: Unable to delete this employee.");
                                }.bind(this)
                            });
                        }
                    }.bind(this)
                }
            );
        },

        onCloseDialog: function () {
            this.byId("employeeDialog").close();
        },

        onSaveEmployee: function () {
            var oModel = this.getView().getModel(); 
            var oDialog = this.byId("employeeDialog");

            var oPayload = {
                Pernr: this.byId("inputPernr").getValue(), 
                Ename: this.byId("inputEname").getValue(), 
                CardId: this.byId("inputCardId").getValue(), 
                DeptId: this.byId("selectDept").getSelectedKey(), 
                RoleId: this.byId("selectRole").getSelectedKey()
            };

            // Validate mandatory fields
            if (!oPayload.Pernr || !oPayload.Ename || !oPayload.CardId || !oPayload.DeptId || !oPayload.RoleId) {
                MessageBox.error("Please fill in all mandatory fields (*)");
                return;
            }

            oDialog.setBusy(true);

            if (this._sAction === "CREATE") {
                // Trigger POST request
                oModel.create("/Employee", oPayload, {
                    success: function () {
                        oModel.refresh(true); 
                        oDialog.setBusy(false);
                        this.onCloseDialog();
                        MessageToast.show("Employee created successfully!");
                    }.bind(this),
                    error: function (oError) {
                        oDialog.setBusy(false);
                        try {
                            var oResponse = JSON.parse(oError.responseText);
                            MessageBox.error(oResponse.error.message.value);
                        } catch (e) {
                            MessageBox.error("System error: Unable to create employee.");
                        }
                    }.bind(this)
                });

            } else if (this._sAction === "EDIT") {
                // Trigger PUT request
                var sPath = oModel.createKey("/Employee", { Pernr: oPayload.Pernr });
                oModel.update(sPath, oPayload, {
                    success: function () {
                        oDialog.setBusy(false);
                        this.onCloseDialog();
                        MessageToast.show("Employee information updated successfully!");
                    }.bind(this),
                    error: function (oError) {
                        oDialog.setBusy(false);
                        MessageBox.error("System error: Unable to update employee information.");
                    }.bind(this)
                });
            }
        }
    });
});