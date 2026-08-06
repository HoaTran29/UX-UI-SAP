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
            // Auto-reload data when routing to this view
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
        // HELPER FUNCTIONS
        // =========================================================
        
        // Retrieve text from i18n, supports dynamic parameters array (e.g., [param1, param2])
        _getI18nText: function (sKey, aArgs) {
            return this.getView().getModel("i18n").getResourceBundle().getText(sKey, aArgs);
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
                    oList.getBinding("items").filter([]); 
                    oList.removeSelections(true);         
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
                this._oInputEmp.setValue(oSelectedItem.getDescription());
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
                    oList.getBinding("items").filter([]); 
                    oList.removeSelections(true);         
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
                this._oInputDept.setValue(oSelectedItem.getDescription()); 
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

                oDialog.setTitle(this._getI18nText("titleCreateEmp"));
                oDialog.open();
            }.bind(this));
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

                oDialog.setTitle(this._getI18nText("titleEditEmp"));
                oDialog.open();
            }.bind(this));
        },

        onDeleteEmployee: function (oEvent) {
            var oModel = this.getView().getModel(); 
            var oContext = oEvent.getSource().getBindingContext();
            var oRowData = oContext.getObject();
            var sPath = oContext.getPath(); 

            var sConfirmMsg = this._getI18nText("msgConfirmDeleteEmp", [oRowData.Ename, oRowData.Pernr]);

            MessageBox.confirm(
                sConfirmMsg,
                {
                    title: this._getI18nText("titleConfirmDelete"),
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    emphasizedAction: MessageBox.Action.YES,
                    onClose: function (oAction) {
                        if (oAction === MessageBox.Action.YES) {
                            this.getView().setBusy(true);

                            // Trigger DELETE to SAP Backend
                            oModel.remove(sPath, {
                                success: function () {
                                    this.getView().setBusy(false);
                                    oModel.refresh(true); 
                                    MessageToast.show(this._getI18nText("msgDeleteEmpSuccess"));
                                }.bind(this),
                                error: function (oError) {
                                    this.getView().setBusy(false);
                                    MessageBox.error(this._getI18nText("msgDeleteEmpError"));
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
                MessageBox.error(this._getI18nText("msgFillMandatoryFields"));
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
                        MessageToast.show(this._getI18nText("msgCreateEmpSuccess"));
                    }.bind(this),
                    error: function (oError) {
                        oDialog.setBusy(false);
                        try {
                            var oResponse = JSON.parse(oError.responseText);
                            MessageBox.error(oResponse.error.message.value);
                        } catch (e) {
                            MessageBox.error(this._getI18nText("msgCreateEmpError"));
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
                        MessageToast.show(this._getI18nText("msgUpdateEmpSuccess"));
                    }.bind(this),
                    error: function (oError) {
                        oDialog.setBusy(false);
                        MessageBox.error(this._getI18nText("msgUpdateEmpError"));
                    }.bind(this)
                });
            }
        }
    });
});