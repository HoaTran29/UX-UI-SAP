sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast"
], function (Controller, JSONModel, MessageToast) {
    "use strict";

    return Controller.extend("com.app.zu26g13.app.controller.Schedule", {
        onInit: function () {
            // Khởi tạo Model Rỗng để View có cái để bind trước
            var oCalendarModel = new JSONModel({
                startDate: new Date(),
                rows: []
            });
            this.getView().setModel(oCalendarModel, "calendar");

            // Gọi hàm lấy dữ liệu thật từ Backend
            this._loadRealScheduleData();
        },

        _loadRealScheduleData: function () {
            var oView = this.getView();
            var oODataModel = this.getOwnerComponent().getModel(); // Lấy mainService từ manifest
            
            oView.setBusy(true); // Hiện vòng xoay loading

            // Gọi API đọc data từ bảng WorkSchedulePlan
            oODataModel.read("/WorkSchedulePlan", {
                success: function (oData) {
                    oView.setBusy(false);
                    var aResults = oData.results;
                    var aRows = [];
                    var oEmployeeMap = {};

                    // Thuật toán gom nhóm Data theo Nhân viên
                    aResults.forEach(function (oRow) {
                        // 1. Nếu chưa có nhân viên này trong danh sách thì tạo mới
                        if (!oEmployeeMap[oRow.Pernr]) {
                            oEmployeeMap[oRow.Pernr] = {
                                EmployeeName: oRow.EmployeeName || oRow.Pernr,
                                DeptId: oRow.DeptId,
                                appointments: []
                            };
                            aRows.push(oEmployeeMap[oRow.Pernr]);
                        }

                        // 2. Xử lý ghép Ngày (PlanDate) và Giờ (ShiftTimeIn/Out)
                        // Note: OData V2 trả về Time dưới dạng object { ms: ... }
                        var dStartDate = new Date();
                        var dEndDate = new Date();

                        if (oRow.PlanDate) {
                            dStartDate = new Date(oRow.PlanDate.getTime());
                            dEndDate = new Date(oRow.PlanDate.getTime());
                        }

                        // Cộng thêm milliseconds của giờ vào ngày
                        if (oRow.ShiftTimeIn && oRow.ShiftTimeIn.ms !== undefined) {
                            dStartDate.setUTCHours(0,0,0,0);
                            dStartDate = new Date(dStartDate.getTime() + oRow.ShiftTimeIn.ms);
                        }
                        if (oRow.ShiftTimeOut && oRow.ShiftTimeOut.ms !== undefined) {
                            dEndDate.setUTCHours(0,0,0,0);
                            dEndDate = new Date(dEndDate.getTime() + oRow.ShiftTimeOut.ms);
                        }

                        // 3. Đẩy ca làm việc vào mảng của nhân viên đó
                        oEmployeeMap[oRow.Pernr].appointments.push({
                            ShiftId: oRow.ShiftId,
                            Plant: oRow.Plant,
                            TimeIn: dStartDate,
                            TimeOut: dEndDate,
                            IsOt: (oRow.IsOt === 'X' || oRow.IsOt === true)
                        });
                    });

                    // 4. Đổ dữ liệu thật đã được gom nhóm lên Lịch
                    var oModel = oView.getModel("calendar");
                    oModel.setProperty("/rows", aRows);

                }.bind(this),
                error: function (oError) {
                    oView.setBusy(false);
                    MessageToast.show("Lỗi khi tải dữ liệu lịch từ Server!");
                    console.error("OData Error:", oError);
                }
            });
        },

        // Sự kiện Kéo thả (Drag & Drop)
        onAppointmentDrop: function (oEvent) {
            var oAppointment = oEvent.getParameter("appointment");
            var oStartDate = oEvent.getParameter("startDate");
            var oEndDate = oEvent.getParameter("endDate");

            // Tạm thời update giao diện, sau này ông có thể thêm code OData Update vào đây
            oAppointment.setStartDate(oStartDate);
            oAppointment.setEndDate(oEndDate);

            MessageToast.show("Đã dời lịch làm việc! Cần code API để lưu xuống DB.");
        },

        onNavBack: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.navTo("dashboard");
        }
    });
});