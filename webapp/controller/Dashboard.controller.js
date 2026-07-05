sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], function (Controller, JSONModel, Filter, FilterOperator) {
    "use strict";

    return Controller.extend("com.app.zu26g13.app.controller.Dashboard", {
        onInit: function () {
            // 1. Khởi tạo Model KPI mặc định ban đầu là 0
            var oKpiModel = new JSONModel({
                totalEmp: 0,
                totalOT: 0,
                pendingDisputes: 0
            });
            this.getView().setModel(oKpiModel, "kpi");

            // 2. Gắn sự kiện: Cứ mỗi lần truy cập vào trang Dashboard là tự động lấy data mới
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("dashboard").attachPatternMatched(this._loadRealKpiData, this);
        },

        // Hàm gọi OData để tính toán số liệu thực tế
        _loadRealKpiData: function () {
            var oModel = this.getOwnerComponent().getModel(); // Lấy mainService từ manifest
            var oKpiModel = this.getView().getModel("kpi");

            // A. Đếm Tổng số nhân viên (Đọc từ bảng Employee)
            oModel.read("/Employee", {
                success: function (oData) {
                    oKpiModel.setProperty("/totalEmp", oData.results.length);
                }
            });

            // B. Đếm số Đơn Report ĐANG CHỜ DUYỆT (Lọc bảng Dispute với Status = PENDING)
            oModel.read("/Dispute", {
                filters: [new Filter("Status", FilterOperator.EQ, "PENDING")],
                success: function (oData) {
                    oKpiModel.setProperty("/pendingDisputes", oData.results.length);
                }
            });

            // C. Tính tổng Giờ OT (Đọc bảng Timesheet và cộng dồn cột OtHours)
            oModel.read("/Timesheet", {
                success: function (oData) {
                    var totalOT = 0;
                    oData.results.forEach(function (item) {
                        if (item.OtHours) {
                            totalOT += parseFloat(item.OtHours);
                        }
                    });
                    // Làm tròn 1 chữ số thập phân
                    oKpiModel.setProperty("/totalOT", totalOT.toFixed(1)); 
                }
            });
        },

        // Các hàm nhảy trang cũ giữ nguyên
        onGoToDispute: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("dispute"); 
        },

        onNavToSchedule: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("schedule"); 
        },
        // THÊM MỚI: Hàm xử lý khi bấm nút Filter Trạng thái
        onFilterStatus: function (oEvent) {
            // 1. Lấy cái key của nút vừa được bấm (ALL, APPROVED, PENDING, ERROR)
            var sKey = oEvent.getParameter("item").getKey();
            var aFilters = [];

            // 2. Tạo điều kiện lọc
            if (sKey !== "ALL") {
                if (sKey === "ERROR") {
                    // Nếu sếp muốn xem lỗi, mình gom cả LATE_IN và EARLY_OUT
                    var oFilterLate = new Filter("Status", FilterOperator.EQ, "LATE_IN");
                    var oFilterEarly = new Filter("Status", FilterOperator.EQ, "EARLY_OUT");
                    // Dùng toán tử OR (and: false) để lọc 1 trong 2 lỗi này
                    aFilters.push(new Filter({filters: [oFilterLate, oFilterEarly], and: false}));
                } else {
                    // Lọc bình thường cho PENDING hoặc APPROVED
                    aFilters.push(new Filter("Status", FilterOperator.EQ, sKey));
                }
            }

            // 3. Lấy cái bảng Timesheet và nhét điều kiện lọc vào
            var oTable = this.byId("timesheetTable");
            var oBinding = oTable.getBinding("items");
            oBinding.filter(aFilters);
        },

        // THÊM MỚI: Hàm xử lý khi bấm nút "Go" trên thanh FilterBar
        onSearch: function () {
            var aFilters = [];
            
            // Lấy dữ liệu sếp vừa nhập vào các ô
            var sEmp = this.byId("fltEmp").getValue();
            var sDept = this.byId("fltDept").getSelectedKey();
            var oDate = this.byId("fltDate").getDateValue();

            // 1. Lọc theo Mã NV (Dùng toán tử Contains để gõ 1 chữ số cũng tìm ra)
            if (sEmp) {
                aFilters.push(new sap.ui.model.Filter("Pernr", sap.ui.model.FilterOperator.Contains, sEmp));
            }
            
            // 2. Lọc theo Phòng ban
            if (sDept) {
                aFilters.push(new sap.ui.model.Filter("DeptId", sap.ui.model.FilterOperator.EQ, sDept));
            }

            // 3. Lọc theo Ngày làm việc
            if (oDate) {
                // Tạo khoảng thời gian từ 0h00 đến 23h59 để cover trọn vẹn ngày đó
                var dStart = new Date(oDate.setHours(0, 0, 0, 0));
                var dEnd = new Date(oDate.setHours(23, 59, 59, 999));
                aFilters.push(new sap.ui.model.Filter("WorkDate", sap.ui.model.FilterOperator.BT, dStart, dEnd));
            }

            // Lấy cái bảng và ép nó hiển thị đúng dữ liệu đã lọc
            var oTable = this.byId("timesheetTable");
            var oBinding = oTable.getBinding("items");
            oBinding.filter(aFilters);
        },

        // THÊM MỚI: Hàm xử lý khi bấm nút "Clear" để xóa trắng bộ lọc
        onClear: function () {
            this.byId("fltEmp").setValue("");
            this.byId("fltDept").setSelectedKey("");
            this.byId("fltDate").setValue("");
            
            // Xóa bộ lọc trên bảng, load lại toàn bộ data
            this.byId("timesheetTable").getBinding("items").filter([]);
        }
    });
});