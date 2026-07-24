sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/core/Fragment",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/BusyIndicator"
  ],
  function (
    Controller,
    Fragment,
    Filter,
    FilterOperator,
    MessageToast,
    MessageBox,
    JSONModel,
    BusyIndicator
  ) {
    "use strict";

    return Controller.extend("com.app.zu26g13.app.controller.EmployeeConfig", {
      onInit: function () {
        this.getView().setModel(
        new JSONModel({
            employees: [],
            allEmployees: []
        }),
        "employeeLookupModel"
    );

    // Model cho Department Value Help
    this.getView().setModel(
        new JSONModel({
            departments: [],
            allDepartments: []
        }),
        "departmentLookupModel"
    );

    // Lưu DeptId đã chọn để filter
    this._sFilterDeptId = "";


       
          
        
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
            text: "Tất cả phòng ban",
          });
          oComboBox.insertItem(oAllItem, 0); // Đẩy lên vị trí trên cùng danh sách
        }
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

      // 1. Xử lý tìm kiếm và lọc dữ liệu (FilterBar)
      onSearch: function () {
    var sPernr = this.byId("filterPernr").getValue();
    var sDept = this._sFilterDeptId;
    var aFilters = [];

    if (sPernr) {
        aFilters.push(new Filter("Pernr", FilterOperator.Contains, sPernr));
    }

    if (sDept) {
        aFilters.push(new Filter("DeptId", FilterOperator.EQ, sDept));
    }

    var oTable = this.byId("employeeTable");
    var oBinding = oTable.getBinding("items");

    if (oBinding) {
        oBinding.filter(aFilters);
    }
},
onClearFilters: function () {

    this.byId("filterPernr").setValue("");
    this.byId("filterDept").setValue("");

    this._sFilterDeptId = "";

    var oBinding = this.byId("employeeTable").getBinding("items");
    if (oBinding) {
        oBinding.filter([]);
    }
},
      onPernrInputValueHelpRequest: function () {
    this._openEmployeeValueHelp();
},
onDeptInputValueHelpRequest: function () {
    this._openDepartmentValueHelp();
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

            BusyIndicator.show(0);

            this._loadEmployeeLookup().then(function () {
                BusyIndicator.hide();
                fnOpenDialog();
            }).catch(function () {
                BusyIndicator.hide();
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

    var oEmployee = oSelectedItem
        .getBindingContext("employeeLookupModel")
        .getObject();

    this.byId("filterPernr").setValue(oEmployee.Pernr);

    this._resetEmployeeValueHelpList();

    // nếu muốn tự tìm kiếm luôn
    this.onSearch();
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

            BusyIndicator.show(0);

            this._loadDepartmentLookup().then(function () {
                BusyIndicator.hide();
                fnOpenDialog();
            }).catch(function () {
                BusyIndicator.hide();
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

    var oDepartment = oSelectedItem
        .getBindingContext("departmentLookupModel")
        .getObject();

    this.byId("filterDept").setValue(oDepartment.DeptName);

    this._sFilterDeptId = oDepartment.DeptId;
    this._resetDepartmentValueHelpList();

    this.onSearch();
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

      // 2. Mở Popup Dialog để TẠO MỚI nhân viên
      onOpenCreateDialog: function () {
        var oView = this.getView();
        this._sAction = "CREATE"; // Đánh dấu hành động tạo mới

        if (!this._pDialog) {
          this._pDialog = Fragment.load({
            id: oView.getId(),
            name: "com.app.zu26g13.app.view.EmployeeDialog", // Sửa namespace ở đây
            controller: this,
          }).then(function (oDialog) {
            oView.addDependent(oDialog);
            return oDialog;
          });
        }

        this._pDialog.then(function (oDialog) {
          // Xóa trống các ô nhập liệu cho HR điền mới
          oView.byId("inputPernr").setValue("").setEditable(true);
          oView.byId("inputEname").setValue("");
          oView.byId("inputCardId").setValue("").setEditable(true);
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
            controller: this,
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
          oView
            .byId("inputCardId")
            .setValue(oRowData.CardId)
            .setEditable(false);

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
        MessageBox.confirm(
          "Bạn có chắc chắn muốn xóa nhân viên " +
            oRowData.Ename +
            " (Mã: " +
            oRowData.Pernr +
            ") không?",
          {
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
                    MessageBox.error(
                      "Lỗi hệ thống SAP, không thể xóa nhân viên này.",
                    );
                  }.bind(this),
                });
              }
            }.bind(this),
          },
        );
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
          Pernr: this.byId("inputPernr").getValue(), // Sửa từ PERNR thành Pernr
          Ename: this.byId("inputEname").getValue(), // Sửa từ ENAME thành Ename
          CardId: this.byId("inputCardId").getValue(), // Sửa từ CARD_ID thành CardId
          DeptId: this.byId("selectDept").getSelectedKey(), // Sửa từ DEPT_ID thành DeptId
          RoleId: this.byId("selectRole").getSelectedKey(), // Sửa từ ROLE_ID thành RoleId
        };

        // Kiểm tra các trường bắt buộc nhập
        if (
          !oPayload.Pernr ||
          !oPayload.Ename ||
          !oPayload.CardId ||
          !oPayload.DeptId ||
          !oPayload.RoleId
        ) {
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

              try {
                var oResponse = JSON.parse(oError.responseText);
                MessageBox.error(oResponse.error.message.value);
              } catch (e) {
                MessageBox.error("Lỗi tạo mới từ hệ thống SAP.");
              }
            }.bind(this),
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
            }.bind(this),
          });
        }
      },
    });
  },
);
