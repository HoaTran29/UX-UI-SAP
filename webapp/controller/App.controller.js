sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/Fragment"
], function (Controller, Fragment) {
    "use strict";

    return Controller.extend("com.app.zu26g13.app.controller.App", {
        
        onInit: function () {
            // khởi tạo router và bắt sự kiện chuyển trang để xử lý global
            this.getOwnerComponent().getRouter().attachRouteMatched(this._onGlobalRouteMatched, this);
        },

        _onGlobalRouteMatched: function (oEvent) {
            // ép model refresh lại data mới nhất
            var oModel = this.getOwnerComponent().getModel();
            if (oModel) oModel.refresh(true);

            // tự động highlight menu đang chọn ở thanh điều hướng bên trái
            var sRouteName = oEvent.getParameter("name"); 
            var oSideNav = this.byId("sideNavigation"); 
            
            if (oSideNav && sRouteName) oSideNav.setSelectedKey(sRouteName);
        },

        onCollapseExpandPress: function () {
            // thu gọn hoặc mở rộng thanh menu bên trái
            var oToolPage = this.byId("toolPage"); 
            if (oToolPage) oToolPage.setSideExpanded(!oToolPage.getSideExpanded());
        },

        onItemSelect: function (oEvent) {
            // chuyển trang khi user bấm vào item trên menu
            var sKey = oEvent.getParameter("item").getKey(); 
            if (sKey) this.getOwnerComponent().getRouter().navTo(sKey);
        },

        // =========================================================
        // popup chính sách (policy dialog)
        // =========================================================
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
            if (this._oPolicyDialog) this._oPolicyDialog.close();
        }
    });
});