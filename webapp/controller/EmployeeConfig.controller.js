sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/Fragment",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, Fragment, Filter, FilterOperator, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("com.app.zu26g13.app.controller.EmployeeConfig", {
        
        onInit: function () {
            // tự động reload dữ liệu bảng khi vào trang này
            this.getOwnerComponent().getRouter().getRoute("employeeConfig").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function () {
            var oTable = this.byId("employeeTable");
            if (oTable && oTable.getBinding("items")) oTable.getBinding("items").refresh();
        },

        _getI18nText: function (sKey, aArgs) {
            return this.getView().getModel("i18n").getResourceBundle().getText(sKey, aArgs);
        },

        // =========================================================
        // tìm kiếm & lọc
        // =========================================================
        onSearch: function () {
            var sPernr = this.byId("filterPernr").getValue();
            var sDept = this.byId("filterDept").getValue();
            var aFilters = [];

            if (sPernr) aFilters.push(new Filter("Pernr", FilterOperator.EQ, sPernr));
            if (sDept) aFilters.push(new Filter("DeptId", FilterOperator.Contains, sDept));

            var oTable = this.byId("employeeTable");
            if (oTable && oTable.getBinding("items")) oTable.getBinding("items").filter(aFilters);
        },

        onClearFilters: function () {
            this.byId("filterPernr").setValue("");
            this.byId("filterDept").setValue("");
            
            var oTable = this.byId("employeeTable");
            if (oTable && oTable.getBinding("items")) oTable.getBinding("items").filter([]);
        },

        // =========================================================
        // popup chọn nhân viên (value help)
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
            var oFilterId = new Filter("Pernr", FilterOperator.EQ, sValue);
            this.byId("empValueHelpList").getBinding("items").filter([new Filter({ filters: [oFilterName, oFilterId], and: false })]);
        },

        onEmployeeValueHelpConfirm: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("listItem");
            if (oSelectedItem && this._oInputEmp) {
                this._oInputEmp.setValue(oSelectedItem.getDescription());
                if (this.onSearch) this.onSearch();
                this._pEmpValueHelpDialog.then(function (oPopover) { oPopover.close(); });
            }
        },

        onEmployeeValueHelpCancel: function () {
            if (this._pEmpValueHelpDialog) this._pEmpValueHelpDialog.then(function (oPopover) { oPopover.close(); });
        },

        // =========================================================
        // popup chọn phòng ban (value help)
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
            this.byId("deptValueHelpList").getBinding("items").filter([new Filter({ filters: [oFilterName, oFilterId], and: false })]);
        },

        onDeptValueHelpConfirm: function (oEvent) {
            var oSelectedItem = oEvent.getParameter("listItem");
            if (oSelectedItem && this._oInputDept) {
                this._oInputDept.setValue(oSelectedItem.getDescription()); 
                if (this.onSearch) this.onSearch();
                this._pDeptValueHelpDialog.then(function (oPopover) { oPopover.close(); });
            }
        },

        onDeptValueHelpCancel: function () {
            if (this._pDeptValueHelpDialog) this._pDeptValueHelpDialog.then(function (oPopover) { oPopover.close(); });
        },

        // =========================================================
        // lưu, sửa, xóa (crud)
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

            var oRowData = oEvent.getSource().getBindingContext().getObject();

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
                // đổ data lên form, khóa mã nv và mã thẻ không cho sửa
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
            var oRowData = oEvent.getSource().getBindingContext().getObject();
            var sPath = oEvent.getSource().getBindingContext().getPath(); 

            MessageBox.confirm(
                this._getI18nText("msgConfirmDeleteEmp", [oRowData.Ename, oRowData.Pernr]),
                {
                    title: this._getI18nText("titleConfirmDelete"),
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    emphasizedAction: MessageBox.Action.YES,
                    onClose: function (oAction) {
                        if (oAction === MessageBox.Action.YES) {
                            this.getView().setBusy(true);
                            oModel.remove(sPath, {
                                success: function () {
                                    this.getView().setBusy(false);
                                    oModel.refresh(true); 
                                    MessageToast.show(this._getI18nText("msgDeleteEmpSuccess"));
                                }.bind(this),
                                error: function () {
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

            // chặn nếu để trống các ô bắt buộc
            if (!oPayload.Pernr || !oPayload.Ename || !oPayload.CardId || !oPayload.DeptId || !oPayload.RoleId) {
                MessageBox.error(this._getI18nText("msgFillMandatoryFields"));
                return;
            }

            oDialog.setBusy(true);

            if (this._sAction === "CREATE") {
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
                var sPath = oModel.createKey("/Employee", { Pernr: oPayload.Pernr });
                oModel.update(sPath, oPayload, {
                    success: function () {
                        oDialog.setBusy(false);
                        this.onCloseDialog();
                        MessageToast.show(this._getI18nText("msgUpdateEmpSuccess"));
                    }.bind(this),
                    error: function () {
                        oDialog.setBusy(false);
                        MessageBox.error(this._getI18nText("msgUpdateEmpError"));
                    }.bind(this)
                });
            }
        }
    });
});