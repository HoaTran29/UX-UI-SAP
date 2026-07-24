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
            var oData = oContext.getObject(); 

            // 1. Chuyển đổi giờ ra chuẩn Edm.Time của SAP
            var formatToODataTime = function(timeVal) {
                if (!timeVal) return null;
                if (typeof timeVal === "object" && timeVal.__edmType === "Edm.Time") return timeVal;
                if (typeof timeVal === "string") {
                    var aParts = timeVal.split(":");
                    if (aParts.length >= 2) {
                        var ms = (parseInt(aParts[0],10)*3600000) + (parseInt(aParts[1],10)*60000) + (parseInt(aParts[2],10)*1000);
                        return { ms: ms, __edmType: "Edm.Time" };
                    }
                }
                return timeVal;
            };

            // 2. Ép kiểu số an toàn cho các trường Decimal
            var sOtHours = oData.OtHours ? parseFloat(oData.OtHours).toString() : "0.00";
            var sTotHours = oData.TotHours ? parseFloat(oData.TotHours).toString() : "0.00"; 
            var sWorkHours = oData.WorkHours ? parseFloat(oData.WorkHours).toString() : "0.00"; 
            
            // Xử lý NUMC2 cho SeqNo (SAP đòi 2 ký tự: "01")
            var sSeqNo = oData.SeqNo ? oData.SeqNo.toString() : "01";
            if (sSeqNo.length === 1) sSeqNo = "0" + sSeqNo;

            // 3. ĐÓNG GÓI PAYLOAD (Giống 100% cấu trúc của ZI_HR_TIMESHEET)
            var oPayload = {
                "Pernr": oData.Pernr,
                "WorkDate": oData.WorkDate,
                "SeqNo": sSeqNo,
                "ShiftId": oData.ShiftId || "",
                "DeptId": oData.DeptId || "",
                "ActIn": formatToODataTime(oData.ActIn),
                "ActOut": formatToODataTime(oData.ActOut),
                "TotHours": sTotHours,
                "WorkHours": sWorkHours,
                "OtHours": sOtHours,
                "Status": oData.Status || "COMPLETED"
            };

            oView.setBusy(true);

            // 4. CHỈ ĐỊNH ĐÍCH ĐẾN
            var sPath = oModel.createKey("/Timesheet", {
                SeqNo: sSeqNo,
                Pernr: oData.Pernr,
                WorkDate: oData.WorkDate
            });

            // 5. GỬI LỆNH UPDATE (Tự bẻ lái qua Create nếu rỗng)
            oModel.update(sPath, oPayload, {
                success: function () {
                    oView.setBusy(false);
                    sap.m.MessageToast.show("Đã CẬP NHẬT thành công vào Database!");
                    oView.byId("editTimesheetDialog").close();
                    oModel.refresh(); 
                },
                error: function (oError) {
                    if (oError.statusCode === "404" || oError.statusCode === 404) {
                        console.log("DB trống, bẻ lái sang Create...");
                        oModel.create("/Timesheet", oPayload, {
                            success: function () {
                                oView.setBusy(false);
                                sap.m.MessageToast.show("Đã TẠO MỚI thành công vào Database!");
                                oView.byId("editTimesheetDialog").close();
                                oModel.refresh();
                            },
                            error: function (errCreate) {
                                oView.setBusy(false);
                                console.error("Lỗi Backend chặn Create:", errCreate);
                                sap.m.MessageToast.show("Lỗi hệ thống khi tạo mới!");
                            }
                        });
                    } else {
                        oView.setBusy(false);
                        console.error("Lỗi Update OData:", oError);
                        sap.m.MessageToast.show("Lỗi: Dữ liệu không khớp chuẩn SAP!");
                    }
                }
            });
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