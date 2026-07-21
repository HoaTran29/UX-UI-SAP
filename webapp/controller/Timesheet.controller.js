sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment" // THÊM THƯ VIỆN FRAGMENT
], function (Controller, Filter, FilterOperator, MessageToast, Fragment) {
    "use strict";

    return Controller.extend("com.app.zu26g13.app.controller.Timesheet", {

        onInit: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("timesheet").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function () {
            var oDatePicker = this.byId("fltDate");
            var oToday = new Date();
            oDatePicker.setDateValue(oToday);
            this.onSearch();
        },

        onSearch: function () {
            var aFilters = [];
            var oDate = this.byId("fltDate").getDateValue();
            var sEmp = this.byId("fltEmp").getValue();

            if (oDate) {
                var y = oDate.getFullYear();
                var m = oDate.getMonth();
                var d = oDate.getDate();

                var dStart = new Date(Date.UTC(y, m, d, 0, 0, 0));
                var dEnd = new Date(Date.UTC(y, m, d, 23, 59, 59));

                aFilters.push(new Filter("WorkDate", FilterOperator.BT, dStart, dEnd));
            }

            if (sEmp) {
                aFilters.push(new Filter("Pernr", FilterOperator.Contains, sEmp));
            }

            var oTable = this.byId("dailyTimesheetTable");
            oTable.getBinding("items").filter(aFilters);
        },

        onClear: function () {
            this.byId("fltDate").setDateValue(new Date());
            this.byId("fltEmp").setValue("");
            this.onSearch();
        },

        onNavBack: function () {
            this.getOwnerComponent().getRouter().navTo("dashboard");
        },

        // --- BƯỚC 3: LOGIC POP-UP CHỈNH SỬA & XÁC NHẬN OT ---

        // 1. Hàm mở Pop-up khi bấm nút Edit hình cây bút
        onEditTimesheet: function (oEvent) {
            var oView = this.getView();
            var oContext = oEvent.getSource().getBindingContext(); // Lấy đúng dòng dữ liệu đang bấm

            // Load Pop-up lên nếu chưa có
            if (!this._pEditDialog) {
                this._pEditDialog = Fragment.load({
                    id: oView.getId(),
                    name: "com.app.zu26g13.app.view.EditTimesheetDialog",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog); // Ràng buộc Model chung
                    return oDialog;
                });
            }

            this._pEditDialog.then(function (oDialog) {
                oDialog.setBindingContext(oContext); // Đổ dữ liệu của nhân viên đó vào Pop-up
                oDialog.open();
            });
        },

        // MỚI THÊM: Hàm tự động tính toán Giờ Thực Tế khi thay đổi Giờ In/Out
        onCalculateActualHours: function (oEvent) {
            // Lấy dòng dữ liệu đang được chỉnh sửa
            var oContext = oEvent.getSource().getBindingContext();
            var oModel = oContext.getModel();

            // Lấy giá trị Giờ In và Giờ Out (OData V2 lưu kiểu Time dưới dạng { ms: số_mili_giây })
            var oActIn = oContext.getProperty("ActIn");
            var oActOut = oContext.getProperty("ActOut");

            // Nếu cả 2 ô đều có giờ thì mới tính
            if (oActIn && oActOut && oActIn.ms !== undefined && oActOut.ms !== undefined) {

                // Tính khoảng cách thời gian (mili giây)
                var iDiffMs = oActOut.ms - oActIn.ms;

                // Nếu ca làm qua đêm (Giờ Out lọt sang ngày hôm sau nên nhỏ hơn Giờ In), cộng thêm 24h
                if (iDiffMs < 0) {
                    iDiffMs += 24 * 60 * 60 * 1000;
                }

                // Đổi mili giây ra Giờ (chia cho 1000ms * 60s * 60p)
                var fTotalHours = iDiffMs / (1000 * 60 * 60);

                // Cập nhật con số vừa tính thẳng vào cột Giờ Thực Tế (TotHours) trên màn hình
                // Làm tròn 2 chữ số thập phân cho đẹp
                oModel.setProperty("TotHours", parseFloat(fTotalHours.toFixed(2)), oContext);
            }
        },

        onSaveTimesheet: function () {
            var oView = this.getView();
            var oModel = oView.getModel();
            var oContext = oView.byId("editTimesheetDialog").getBindingContext();
            
            // 1. Lấy dữ liệu thô từ dòng đang chọn (của WorkingTime)
            var oData = oContext.getObject();

            // 2. Ép kiểu String cho 2 cột Decimal (Bài học đắt giá lúc nãy)
            var sOtHours = "0"; 
            if (oData.OtHours !== null && oData.OtHours !== undefined && oData.OtHours !== "") {
                sOtHours = parseFloat(oData.OtHours).toString();
            }

            var sTotHours = "0";
            if (oData.TotHours !== null && oData.TotHours !== undefined && oData.TotHours !== "") {
                sTotHours = parseFloat(oData.TotHours).toString();
            }

            // 3. Đóng gói Payload gửi sang bảng Timesheet
            var oPayload = {
                "Pernr": oData.Pernr,
                "WorkDate": oData.WorkDate,
                "SeqNo": oData.SeqNo || "1", // Nếu ABSENT thì SeqNo thường rỗng, mặc định gán là 1
                "ActIn": oData.ActIn, 
                "ActOut": oData.ActOut,
                "OtHours": sOtHours,
                "TotHours": sTotHours
                // Tùy Backend của ông có bắt buộc truyền Status hay không, nếu có thì thêm: "Status": "PRESENT"
            };

            oView.setBusy(true);

            // 4. KIỂM TRA: NẾU VẮNG MẶT THÌ TẠO MỚI (CREATE), CÓ MẶT RỒI THÌ CẬP NHẬT (UPDATE)
            if (oData.status === "ABSENT") {
                // Chưa có dòng dưới DB -> Gọi lệnh POST để tạo mới
                oModel.create("/Timesheet", oPayload, {
                    success: function () {
                        oView.setBusy(false);
                        sap.m.MessageToast.show("Đã tạo mới giờ làm (Xóa ABSENT)!");
                        oView.byId("editTimesheetDialog").close();
                        oModel.refresh(); // Tải lại bảng WorkingTime
                    },
                    error: function (oError) {
                        oView.setBusy(false);
                        console.error("Lỗi Create:", oError);
                        sap.m.MessageToast.show("Lỗi khi thêm giờ mới!");
                    }
                });
            } else {
                // Đã có giờ rồi -> Gọi lệnh MERGE/PUT để sửa
                // Tạo lại đúng đường dẫn Key của bảng Timesheet
                var sPath = oModel.createKey("/Timesheet", {
                    SeqNo: oData.SeqNo,
                    Pernr: oData.Pernr,
                    WorkDate: oData.WorkDate
                });

                oModel.update(sPath, oPayload, {
                    success: function () {
                        oView.setBusy(false);
                        sap.m.MessageToast.show("Cập nhật giờ làm thành công!");
                        oView.byId("editTimesheetDialog").close();
                        oModel.refresh(); 
                    },
                    error: function (oError) {
                        oView.setBusy(false);
                        console.error("Lỗi Update:", oError);
                        sap.m.MessageToast.show("Lỗi khi cập nhật!");
                    }
                });
            }
        },

        // 3. Hàm Hủy (Đóng Pop-up và reset data đã bấm nhầm)
        onCancelTimesheet: function () {
            this.getView().getModel().resetChanges(); // Trả lại số cũ nếu người dùng đổi ý không lưu
            this.byId("editTimesheetDialog").close();
        },
        // 1. Xử lý Trạng thái: Không đánh vắng cho ngày tương lai
        formatStatusText: function (sStatus, dWorkDate) {
            if (!dWorkDate) {
                return sStatus;
            }

            var oToday = new Date();
            oToday.setHours(0, 0, 0, 0); // Đưa về mốc 0h để so sánh ngày
            var oWork = new Date(dWorkDate);
            oWork.setHours(0, 0, 0, 0);

            // Nếu ngày làm việc lớn hơn hôm nay -> Chưa tới ngày làm
            if (oWork > oToday) {
                return "NOT YET";
            }

            // Nếu là quá khứ hoặc hôm nay thì giữ nguyên Data gốc
            return sStatus; 
        },

        // 2. Xử lý Màu sắc Trạng thái
        formatStatusState: function (sStatus, dWorkDate) {
            if (!dWorkDate) {
                return "None";
            }

            var oToday = new Date();
            oToday.setHours(0, 0, 0, 0);
            var oWork = new Date(dWorkDate);
            oWork.setHours(0, 0, 0, 0);

            // Ngày tương lai cho màu xám trung tính (None) hoặc xanh dương (Information)
            if (oWork > oToday) {
                return "None"; 
            }

            // Tô màu theo logic cũ
            if (sStatus === "ABSENT") return "Error";          // Đỏ
            if (sStatus === "COMPLETED") return "Success";     // Xanh lá
            if (sStatus === "COMPENSATE") return "Warning";    // Vàng
            return "None";
        },

        // 3. Xử lý hiển thị Giờ 00:00 thay vì 12:00:00 AM
        formatTimeDisplay: function (oTime, dWorkDate) {
            var oToday = new Date();
            oToday.setHours(0, 0, 0, 0);
            var oWork = new Date(dWorkDate);
            oWork.setHours(0, 0, 0, 0);

            // Nếu là ngày tương lai, hoặc time rỗng/bằng 0 -> Trả về 00:00
            if (oWork > oToday || !oTime || oTime.ms === 0 || oTime === "PT00H00M00S") {
                return "00:00";
            }

            // Nếu có giờ làm thực tế, format ra chuẩn 24h (HH:mm:ss)
            var timeFormat = sap.ui.core.format.DateFormat.getTimeInstance({ pattern: "HH:mm:ss", UTC: true });
            return timeFormat.format(new Date(oTime.ms));
        }
    });

    
});