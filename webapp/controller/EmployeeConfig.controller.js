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
            // Lấy control ComboBox phòng ban từ giao diện
            var oComboBox = this.byId("filterDept");

            // GIẢI PHÁP DỨT ĐIỂM: Đợi binding khởi tạo thành công và lắng nghe sự kiện thay đổi dữ liệu
            oComboBox.attachModelContextChange(function () {
                var oBinding = oComboBox.getBinding("items");
                if (oBinding) {
                    // Ngắt các event cũ nếu có để tránh lặp hàm
                    oBinding.detachDataReceived(this._onDeptDataReceived, this);
                    // Lắng nghe khi dữ liệu từ OData thực sự đổ về ComboBox
                    oBinding.attachDataReceived(this._onDeptDataReceived, this);
                }
            }.bind(this));
        },

        // Hàm bổ trợ: Tự động chèn dòng "Tất cả" vào vị trí đầu tiên sau khi Backend load xong dữ liệu
        _onDeptDataReceived: function (oEvent) {
            var oComboBox = this.byId("filterDept");
            var aItems = oComboBox.getItems();
            
            // Kiểm tra xem dòng Tất cả đã tồn tại chưa để không bị chèn trùng lặp
            var bHasAll = aItems.some(function (oItem) { 
                return oItem.getKey() === "ALL"; 
            });

            if (!bHasAll) {
                var oAllItem = new sap.ui.core.Item({
                    key: "ALL",
                    text: "Tất cả phòng ban"
                });
                oComboBox.insertItem(oAllItem, 0); // Đẩy lên vị trí trên cùng danh sách
            }
        },

        // 1. Xử lý tìm kiếm và lọc dữ liệu (FilterBar)
        onSearch: function () {
            var sPernr = this.byId("filterPernr").getValue();
            var sDept = this.byId("filterDept").getSelectedKey(); 
            var sDeptText = this.byId("filterDept").getValue();
            var aFilters = [];

            if (sPernr) {
                aFilters.push(new Filter("Pernr", FilterOperator.Contains, sPernr));
            }
            
            // ĐIỀU KIỆN QUYẾT ĐỊNH ĐỂ QUAY VỀ FULL DATA:
            // Nếu sDept rỗng (do người dùng tự xóa chữ) HOẶC sDept bằng "ALL" (chọn dòng Tất cả)
            // Hệ thống sẽ bỏ qua bộ lọc phòng ban này -> Trả lại đầy đủ danh sách ban đầu
            if (sDept && sDept !== "ALL" && sDeptText !== "") {
                aFilters.push(new Filter("DeptId", FilterOperator.EQ, sDept));
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
                    name: "com.app.zu26g13.app.view.EmployeeDialog",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }

            this._pDialog.then(function (oDialog) {
                // 1. ĐỔ DỮ LIỆU CŨ LÊN POPUP (Đổi từ CHỮ HOA về chuẩn CamelCase để khớp OData)
                oView.byId("inputPernr").setValue(oRowData.Pernr).setEditable(false); // Khóa mã nhân viên
                oView.byId("inputEname").setValue(oRowData.Ename);
                
                // 2. KHÓA CHÍNH XÁC TRƯỜNG MÃ SỐ THẺ (Đổi từ true thành false)
                oView.byId("inputCardId").setValue(oRowData.CardId).setEditable(false); 
                
                // Đổ dữ liệu cho các Select combobox
                oView.byId("selectDept").setSelectedKey(oRowData.DeptId);
                oView.byId("selectRole").setSelectedKey(oRowData.RoleId);

                oDialog.setTitle("Chỉnh sửa thông tin nhân viên");
                oDialog.open();
            });
        },
        onDeleteEmployee: function (oEvent) {
            var oModel = this.getView().getModel(); // Lấy OData Model
            var oContext = oEvent.getSource().getBindingContext();
            var oRowData = oContext.getObject();
            var sPath = oContext.getPath(); // Đường dẫn OData của dòng (Ví dụ: /Employee('00002125'))

            // Hiển thị hộp thoại xác nhận trước khi xóa
            MessageBox.confirm("Bạn có chắc chắn muốn xóa nhân viên " + oRowData.Ename + " (Mã: " + oRowData.Pernr + ") không?", {
                title: "Xác nhận xóa",
                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                emphasizedAction: MessageBox.Action.YES,
                onClose: function (oAction) {
                    if (oAction === MessageBox.Action.YES) {
                        
                        // Bật trạng thái bận (Busy) cho toàn bộ View để tránh người dùng bấm lung tung khi đang xóa
                        this.getView().setBusy(true);

                        // Gọi API Remove (DELETE) xuống Backend SAP RAP
                        oModel.remove(sPath, {
                            success: function () {
                                this.getView().setBusy(false);
                                MessageToast.show("Đã xóa nhân viên thành công!");
                                // Hệ thống RAP / OData V2 sẽ tự động làm mới (refresh) lại bảng dữ liệu trên giao diện
                            }.bind(this),
                            error: function (oError) {
                                this.getView().setBusy(false);
                                MessageBox.error("Lỗi hệ thống SAP, không thể xóa nhân viên này.");
                            }.bind(this)
                        });
                    }
                }.bind(this)
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