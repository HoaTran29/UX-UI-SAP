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
            var oContext = oEvent.getSource().getBindingContext(); 

            // TẠO BẢN SAO DATA (DEEP COPY): Ngắt kết nối để gõ giờ không bị nhảy số ở bảng bên ngoài
            var oRowData = JSON.parse(JSON.stringify(oContext.getObject()));
            var oDialogModel = new sap.ui.model.json.JSONModel(oRowData);

            if (!this._pEditDialog) {
                this._pEditDialog = sap.ui.core.Fragment.load({
                    id: oView.getId(),
                    name: "com.app.zu26g13.app.view.EditTimesheetDialog",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog); 
                    return oDialog;
                });
            }

            this._pEditDialog.then(function (oDialog) {
                // Ép Dialog xài cái Model ảo cục bộ vừa tạo
                oDialog.setModel(oDialogModel);
                oDialog.bindElement("/"); 

                // Lưu giữ đường dẫn OData gốc vào túi quần (để xài lúc Save)
                oDialog.data("originalPath", oContext.getPath()); 

                oDialog.open();
            });
        },

        // 2. Hàm Save (Đã cập nhật Khiên Thép đặc chế cho sếp Hòa)
        onSaveTimesheet: function () {
            var oView = this.getView();
            var oODataModel = oView.getModel(); 
            var oDialog = this.byId("editTimesheetDialog");
            
            var oData = oDialog.getModel().getData(); 
            var sPath = oDialog.data("originalPath");
            
            // Rút dữ liệu GỐC từ OData Model ra để đối chiếu 
            var oOriginalData = oODataModel.getProperty(sPath); 

            // --- 1. CHUẨN HÓA NGÀY LÀM VIỆC ĐỂ XÀI CHO VALIDATION ---
            var dWorkDate = oData.WorkDate; 
            if (typeof dWorkDate === "string" && dWorkDate.indexOf("/Date(") === 0) {
                var iTime = parseInt(dWorkDate.replace(/\D/g, ""), 10);
                dWorkDate = new Date(iTime);
            } else if (!(dWorkDate instanceof Date)) {
                dWorkDate = new Date(dWorkDate); 
            }
            var dODataWorkDate = new Date(Date.UTC(dWorkDate.getFullYear(), dWorkDate.getMonth(), dWorkDate.getDate(), 0, 0, 0));

            // Lấy mốc ngày hôm nay (00:00:00) để so sánh xem ca có đang chạy không
            var dToday = new Date();
            dToday.setHours(0, 0, 0, 0);

            // --- 2. HÀM BÓC TÁCH GIỜ THÀNH SỐ GIÂY ---
            var getSecondsFromTime = function(t) {
                if (!t) return 0;
                var h = 0, m = 0, s = 0;
                if (typeof t === "string") {
                    if (t.indexOf("PT") === 0) {
                        var aMatch = t.match(/PT(\d+)H(\d+)M(\d+)S/);
                        if(aMatch) { h = parseInt(aMatch[1]); m = parseInt(aMatch[2]); s = parseInt(aMatch[3]); }
                    } else {
                        var aParts = t.split(":");
                        if (aParts.length >= 2) { h = parseInt(aParts[0]); m = parseInt(aParts[1]); s = aParts[2] ? parseInt(aParts[2]) : 0; }
                    }
                } else if (t.ms !== undefined) {
                    return Math.floor(t.ms / 1000);
                }
                return (h * 3600) + (m * 60) + s;
            };

            var iNewInSec = getSecondsFromTime(oData.ActIn);
            var iNewOutSec = getSecondsFromTime(oData.ActOut);
            var iOldInSec = oOriginalData ? getSecondsFromTime(oOriginalData.ActIn) : 0;
            var iOldOutSec = oOriginalData ? getSecondsFromTime(oOriginalData.ActOut) : 0;

            // ==========================================================
            // DÀN KHIÊN BẢO VỆ FRONT-END (VALIDATION)
            // ==========================================================
            
            // Khiên 1: Bắt buộc phải có Giờ Check-in (Đi làm là phải có giờ vào)
            if (iNewInSec === 0) {
                sap.m.MessageBox.error("Vui lòng nhập Giờ Check-in!");
                return;
            }

            // Khiên 5 (Đặc chế cho sếp Hòa): Ca đang chạy thì cấm gõ Check-out tay
            // (Điều kiện: Ngày làm việc = Hôm nay + Chưa có giờ Check-out gốc + Đang cố nhập giờ Check-out mới)
            if (dWorkDate.getTime() === dToday.getTime() && iOldOutSec === 0 && iNewOutSec > 0) {
                sap.m.MessageBox.error("Ca làm việc đang diễn ra! Hệ thống đang đợi dữ liệu quẹt thẻ thực tế, không được điền tay Giờ Check-out lúc này để tránh ghi đè.");
                return;
            }

            // Khiên 2: Chống gian lận đi làm sớm (Chỉ cản nếu ban đầu đã có quẹt thẻ)
            if (iOldInSec > 0 && iNewInSec < iOldInSec) {
                sap.m.MessageBox.error("Này này! Không được ăn gian lùi giờ Check-in SỚM HƠN giờ quẹt thẻ gốc đâu nhé!");
                return;
            }

            // Khiên 3: Chống gian lận về muộn câu OT 
            if (iOldOutSec > 0 && iNewOutSec > iOldOutSec) {
                sap.m.MessageBox.error("Khoan đã! Không được chỉnh giờ Check-out TRỄ HƠN giờ quẹt thẻ gốc để câu OT đâu nha!");
                return;
            }

            // Khiên 4: Chống Logic Ảo Ma (Chỉ check khi user đã nhập cả In và Out)
            if (iNewInSec > 0 && iNewOutSec > 0) {
                var iDiff = iNewOutSec - iNewInSec;
                if (iDiff < 0) { iDiff += 24 * 3600; } // Ca qua đêm
    
                if (iDiff === 0) {
                    sap.m.MessageBox.error("Lỗi logic: Giờ Check-in và Check-out không được trùng nhau!");
                    return;
                }
                if (iDiff > 16 * 3600) { 
                    sap.m.MessageBox.error("Thời gian làm việc vượt quá 16 tiếng? HR không tin đâu, vui lòng kiểm tra lại!");
                    return;
                }
            }

            // ==========================================================
            // VƯỢT QUA KIỂM DUYỆT -> ĐÓNG GÓI GỬI XUỐNG ABAP
            // ==========================================================

            var formatToODataTime = function(sTime) {
                if (!sTime) return null; // Trả về null nếu ô giờ bị bỏ trống (hợp lệ cho ca đang chạy)
                var s = getSecondsFromTime(sTime);
                return { ms: s * 1000, __edmType: "Edm.Time" };
            };

            var sOtHours = oData.OtHours ? parseFloat(oData.OtHours).toString() : "0.00";
            var sWorkHours = oData.WorkHours ? parseFloat(oData.WorkHours).toString() : "0.00"; 
            
            var sSeqNo = oData.SeqNo ? oData.SeqNo.toString() : "01";
            if (sSeqNo.length === 1) sSeqNo = "0" + sSeqNo;

            var oPayload = {
                "Pernr": oData.Pernr,
                "WorkDate": dODataWorkDate,
                "SeqNo": sSeqNo,
                "ShiftId": oData.ShiftId || "",
                "DeptId": oData.DeptId || "",
                "ActIn": formatToODataTime(oData.ActIn),
                "ActOut": formatToODataTime(oData.ActOut),
                "WorkHours": sWorkHours,
                "OtHours": sOtHours,
                "Status": oData.Status || "COMPLETED"
            };

            var sNewPath = oODataModel.createKey("/Timesheet", {
                SeqNo: sSeqNo,
                Pernr: oData.Pernr,
                WorkDate: dODataWorkDate 
            });

            oDialog.setBusy(true);

            oODataModel.update(sNewPath, oPayload, {
                success: function () {
                    oDialog.setBusy(false);
                    sap.m.MessageToast.show("Đã CẬP NHẬT thành công!");
                    oDialog.close();
                    oODataModel.refresh(true); 
                },
                error: function (oError) {
                     if (oError.statusCode === "404" || oError.statusCode === 404) {
                        oODataModel.create("/Timesheet", oPayload, {
                            success: function () {
                                oDialog.setBusy(false);
                                sap.m.MessageToast.show("Đã TẠO MỚI thành công!");
                                oDialog.close();
                                oODataModel.refresh(true);
                            },
                            error: function () {
                                oDialog.setBusy(false);
                                sap.m.MessageToast.show("Lỗi hệ thống khi tạo mới!");
                            }
                        });
                    } else {
                        oDialog.setBusy(false);
                        sap.m.MessageToast.show("Lỗi: Dữ liệu không khớp chuẩn SAP!");
                    }
                }
            });
        },

        onCancelTimesheet: function () {
            var oDialog = this.byId("editTimesheetDialog");
            if (oDialog) {
                oDialog.close();
            }
        },

        formatStatusText: function (sStatus, dWorkDate) {
            if (!sStatus) {
                return "";
            }
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