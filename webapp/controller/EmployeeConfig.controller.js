sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/Fragment",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, Fragment, Filter, FilterOperator, MessageToast, MessageBox) {
    "use strict";

    // LƯU Ý: Bạn thay đổi 'com.mycompany.hr' thành đúng Namespace của dự án bạn
    return Controller.extend("com.app.zu26g13.app.controller.EmployeeConfig", {

        onInit: function () {
            // Khởi tạo controller
        },

        // 1. Xử lý tìm kiếm và lọc dữ liệu (FilterBar)
        onSearch: function () {
            var sPernr = this.byId("filterPernr").getValue();
            var sDept = this.byId("filterDept").getSelectedKey();
            var aFilters = [];

            if (sPernr) {
    aFilters.push(new Filter("Pernr", FilterOperator.Contains, sPernr)); // SỬA: PERNR thành Pernr
}
if (sDept) {
    aFilters.push(new Filter("DeptId", FilterOperator.EQ, sDept));    // SỬA: DEPT_ID thành DeptId
}

            var oTable = this.byId("employeeTable");
            var oBinding = oTable.getBinding("items");
            if (oBinding) {
                oBinding.filter(aFilters);
            }
        },

        // 2. Mở Popup Dialog để TẠO MỚI nhân viên
        onOpenCreateDialog: function () {
            var oView = this.getView();
            this._sAction = "CREATE"; // Đánh dấu hành động tạo mới

            if (!this._pDialog) {
                this._pDialog = Fragment.load({
                    id: oView.getId(),
                    name: "com.app.zu26g13.app.view.EmployeeDialog", // Sửa namespace ở đây
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }

            this._pDialog.then(function (oDialog) {
                // Xóa trống các ô nhập liệu cho HR điền mới
                oView.byId("inputPernr").setValue("").setEditable(true);
                oView.byId("inputEname").setValue("");
                oView.byId("inputCardId").setValue("");
                oView.byId("selectDept").setSelectedKey("");
                oView.byId("selectRole").setSelectedKey("");
                
                oDialog.setTitle("Tạo mới nhân viên");
                oDialog.open();
            });
        },

        // 3. Mở Popup Dialog để CHỈNH SỬA nhân viên đã chọn
        onOpenEditDialog: function (oEvent) {
            var oView = this.getView();
            this._sAction = "EDIT"; // Đánh dấu hành động chỉnh sửa
            
            // Lấy dòng dữ liệu đang được click từ Table
            var oContext = oEvent.getSource().getBindingContext();
            var oRowData = oContext.getObject();

            if (!this._pDialog) {
                this._pDialog = Fragment.load({
                    id: oView.getId(),
                    name: "com.mycompany.hr.view.EmployeeDialog", // Sửa namespace ở đây
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }

            this._pDialog.then(function (oDialog) {
                // Điền dữ liệu hiện tại vào các ô Input
                oView.byId("inputPernr").setValue(oRowData.PERNR).setEditable(false); // Khóa không cho sửa Key
                oView.byId("inputEname").setValue(oRowData.ENAME);
                oView.byId("inputCardId").setValue(oRowData.CARD_ID);
                oView.byId("selectDept").setSelectedKey(oRowData.DEPT_ID);
                oView.byId("selectRole").setSelectedKey(oRowData.ROLE_ID);

                oDialog.setTitle("Chỉnh sửa thông tin nhân viên");
                oDialog.open();
            });
        },

        // 4. Đóng Popup khi bấm nút Hủy
        onCloseDialog: function () {
            this.byId("employeeDialog").close();
        },

        // 5. Gửi dữ liệu xuống SAP Backend khi bấm nút Lưu
        onSaveEmployee: function () {
    var oModel = this.getView().getModel(); // Lấy OData Model mặc định
    
    /* SỬA LẠI TÊN TRƯỜNG CHO ĐÚNG CHUẨN CDS VIEW (CAMELCASE) */
    var oPayload = {
        Pernr: this.byId("inputPernr").getValue(),     // Sửa từ PERNR thành Pernr
        Ename: this.byId("inputEname").getValue(),     // Sửa từ ENAME thành Ename
        CardId: this.byId("inputCardId").getValue(),   // Sửa từ CARD_ID thành CardId
        DeptId: this.byId("selectDept").getSelectedKey(), // Sửa từ DEPT_ID thành DeptId
        RoleId: this.byId("selectRole").getSelectedKey()  // Sửa từ ROLE_ID thành RoleId
    };

    // Kiểm tra các trường bắt buộc nhập
    if (!oPayload.Pernr || !oPayload.Ename || !oPayload.DeptId || !oPayload.RoleId) {
        MessageBox.error("Vui lòng điền đầy đủ thông tin bắt buộc (*)");
        return;
    }

    var oDialog = this.byId("employeeDialog");
    oDialog.setBusy(true);

    if (this._sAction === "CREATE") {
        // Gọi API Create (POST) của OData xuống EntitySet /Employee
        oModel.create("/Employee", oPayload, {
            success: function () {
                oDialog.setBusy(false);
                this.onCloseDialog();
                MessageToast.show("Đã thêm nhân viên mới thành công!");
                var oTable = this.byId("employeeTable");
            if (oTable && oTable.getBinding("items")) {
                oTable.getBinding("items").refresh();
            }
            }.bind(this),
            error: function (oError) {
                oDialog.setBusy(false);
                MessageBox.error("Lỗi tạo mới từ hệ thống SAP.");
            }.bind(this)
        });
    } else if (this._sAction === "EDIT") {
        // Tạo đường dẫn khóa chính (Ví dụ: /Employee('00002125'))
        var sPath = oModel.createKey("/Employee", { Pernr: oPayload.Pernr });
        
        // Gọi API Update (PUT) của OData
        oModel.update(sPath, oPayload, {
            success: function () {
                oDialog.setBusy(false);
                this.onCloseDialog();
                MessageToast.show("Cập nhật thông tin thành công!");
            }.bind(this),
            error: function (oError) {
                oDialog.setBusy(false);
                MessageBox.error("Lỗi cập nhật thông tin.");
            }.bind(this)
        });
    }
}
    });
});