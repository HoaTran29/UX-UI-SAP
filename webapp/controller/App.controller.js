sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/Fragment"
], function (Controller, Fragment) {
    "use strict";

    return Controller.extend("com.app.zu26g13.app.controller.App", {
        
        onInit: function () {
            // Initialize router and attach global route matched event
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.attachRouteMatched(this._onGlobalRouteMatched, this);
        },

        _onGlobalRouteMatched: function (oEvent) {
            // Force model data refresh
            var oModel = this.getOwnerComponent().getModel();
            if (oModel) {
                oModel.refresh(true);
            }

            // Auto-highlight the active menu item in SideNavigation
            var sRouteName = oEvent.getParameter("name"); 
            var oSideNav = this.byId("sideNavigation"); 
            
            if (oSideNav && sRouteName) {
                oSideNav.setSelectedKey(sRouteName);
            }
        },

        onCollapseExpandPress: function () {
            // Toggle side menu (collapse/expand)
            var oToolPage = this.byId("toolPage"); 
            if (oToolPage) {
                var bExpanded = oToolPage.getSideExpanded();
                oToolPage.setSideExpanded(!bExpanded);
            }
        },

        onItemSelect: function (oEvent) {
            // Handle side menu item selection and navigate to the matched route
            var oItem = oEvent.getParameter("item");
            var sKey = oItem.getKey(); 

            if (sKey) {
                var oRouter = this.getOwnerComponent().getRouter();
                oRouter.navTo(sKey);
            }
        },

        onOpenPolicy: function (oEvent) {
            var oView = this.getView();

            if (!this._oPolicyDialog) {
                Fragment.load({
                    id: oView.getId(),
                    name: "com.app.zu26g13.app.view.PolicyDialog", 
                    controller: this
                }).then(function (oDialog) {
                    this._oPolicyDialog = oDialog;

                    oView.addDependent(this._oPolicyDialog);
                    
                    this._oPolicyDialog.bindElement("/Policy('POL_1')");
                    
                    this._oPolicyDialog.open();
                }.bind(this));
            } else {
                this._oPolicyDialog.open();
            }
        },

        onClosePolicy: function () {
            if (this._oPolicyDialog) {
                this._oPolicyDialog.close();
            }
        }

    });
});