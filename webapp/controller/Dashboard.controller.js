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
        }
    });
});