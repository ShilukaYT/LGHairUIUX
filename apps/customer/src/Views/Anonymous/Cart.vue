<template>
  <div class="w-full min-h-screen bg-[#fafafa] pb-44 text-neutral-800 animate-in fade-in duration-300 font-sans">
    
    <!-- ========================================================================= -->
    <!-- 1. CLEAN SALON HEADER (CHUẨN FONT & TYPOGRAPHY HAUTE COIFFURE) -->
    <!-- ========================================================================= -->
    <div class="bg-white border-b border-neutral-200/70 py-10 md:py-12 text-center">
      <div class="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8">
        <h1 class="text-2xl md:text-3xl font-heading uppercase tracking-[0.2em] text-neutral-900 mb-2 font-medium">
          Giỏ Hàng Của Bạn
        </h1>
        <p class="text-[11px] uppercase tracking-widest text-neutral-400 font-normal">
          Dịch vụ làm đẹp & Sản phẩm chăm sóc tóc cao cấp tại LG Hair
        </p>
      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- 2. MAIN CONTAINER -->
    <!-- ========================================================================= -->
    <div class="max-w-[1240px] mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">

      <!-- BANNER HẾT HẠN PHIÊN ĐĂNG NHẬP -->
      <div v-if="isSessionExpired" class="p-4 rounded-xl border border-amber-200 bg-amber-50/90 shadow-2xs flex items-start justify-between gap-3 animate-in fade-in duration-200">
        <div class="flex items-start gap-3">
          <div class="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 text-amber-700 mt-0.5">
            <AlertCircle :size="16" />
          </div>
          <div>
            <div class="text-xs uppercase tracking-wider font-bold text-amber-950 flex items-center gap-2">
              Phiên đăng nhập đã hết hạn
              <span class="px-2 py-0.5 text-[9px] font-semibold bg-amber-200/80 text-amber-900 rounded-md">Cần đăng nhập</span>
            </div>
            <p class="text-xs text-amber-900/80 mt-1 leading-relaxed">
              Đăng nhập lại để tự động đồng bộ giỏ hàng với tài khoản của bạn và nhận các ưu đãi thành viên.
            </p>
            <div class="mt-2.5 flex items-center gap-3">
              <router-link :to="{ name: 'login', query: { redirect: '/cart' } }" class="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-black text-white text-[11px] font-semibold hover:bg-neutral-800 rounded-md transition-colors shadow-2xs">
                Đăng Nhập Lại
              </router-link>
              <button type="button" @click="isSessionExpired = false" class="text-xs text-amber-900/80 hover:text-black underline transition-colors cursor-pointer">
                Bỏ qua
              </button>
            </div>
          </div>
        </div>
        <button type="button" @click="isSessionExpired = false" class="text-amber-400 hover:text-amber-800 p-1 cursor-pointer">
          <X :size="15" />
        </button>
      </div>

      <!-- LOADER -->
      <div v-if="isLoading" class="flex flex-col items-center justify-center py-32 bg-white rounded-xl border border-neutral-200/80 shadow-2xs">
        <div class="w-8 h-8 border-2 border-neutral-200 border-t-black rounded-full animate-spin"></div>
        <p class="mt-4 text-xs uppercase tracking-widest text-neutral-400 font-medium">Đang tải giỏ hàng...</p>
      </div>

      <!-- TRẠNG THÁI TRỐNG HOÀN TOÀN -->
      <div v-else-if="serviceItems.length === 0 && productItems.length === 0" class="flex flex-col items-center justify-center py-24 px-4 text-center bg-white rounded-xl border border-neutral-200/80 shadow-2xs">
        <div class="w-16 h-16 bg-neutral-100 rounded-full flex items-center justify-center mb-4 text-neutral-400">
          <ShoppingBag :size="28" :stroke-width="1.2" />
        </div>
        <h2 class="text-base font-heading uppercase tracking-wider text-neutral-900 mb-1.5 font-medium">Giỏ hàng của bạn đang trống</h2>
        <p class="text-neutral-500 text-xs max-w-md mb-6 leading-relaxed">
          Bạn chưa chọn dịch vụ làm tóc hoặc sản phẩm nào. Hãy khám phá bảng dịch vụ hoặc cửa hàng của chúng tôi.
        </p>
        <div class="flex flex-wrap items-center justify-center gap-3">
          <router-link :to="{ name: 'dmdv' }" class="inline-flex items-center gap-2 px-5 py-2.5 bg-black text-white text-xs uppercase tracking-wider font-semibold rounded-lg hover:bg-neutral-800 transition-all shadow-sm">
            Danh Mục Dịch Vụ
          </router-link>
          <router-link :to="{ name: 'shop' }" class="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-neutral-900 border border-neutral-300 text-xs uppercase tracking-wider font-semibold rounded-lg hover:bg-neutral-50 transition-all shadow-2xs">
            Cửa Hàng Sản Phẩm
          </router-link>
        </div>
      </div>

      <!-- DANH SÁCH GIỎ HÀNG CHUẨN (TYPOGRAPHY TINH TẾ) -->
      <div v-else class="space-y-6">

        <!-- ========================================================================= -->
        <!-- MASTER TOP SELECTION & ACTION BAR -->
        <!-- ========================================================================= -->
        <div class="bg-white px-5 py-3.5 rounded-xl border border-neutral-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-4">
            <label class="flex items-center gap-2.5 cursor-pointer select-none group">
              <input 
                type="checkbox" 
                :checked="isAllSelected" 
                @change="toggleAll" 
                class="w-4 h-4 rounded border-neutral-300 text-black accent-black focus:ring-black cursor-pointer" 
              />
              <span class="text-xs sm:text-sm font-medium text-neutral-900 group-hover:text-black">
                Chọn tất cả ({{ totalItemCount }} mục)
              </span>
            </label>

            <span class="text-neutral-300">|</span>

            <span class="text-xs text-neutral-500 font-normal">
              Đã chọn: <b class="text-neutral-900 font-semibold">{{ totalSelectedCount }}</b> / {{ totalItemCount }} mục
            </span>
          </div>

          <div class="flex items-center gap-3">
            <button 
              v-if="totalSelectedCount > 0"
              @click="removeSelectedItems"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300 text-xs font-medium transition-all cursor-pointer shadow-2xs"
            >
              <Trash2 :size="13" /> Xóa mục đã chọn ({{ totalSelectedCount }})
            </button>
            <button 
              @click="confirmClearAll"
              class="px-3 py-1.5 rounded-lg border border-neutral-200 bg-neutral-50 hover:bg-neutral-100 hover:border-neutral-300 text-neutral-600 hover:text-neutral-900 text-xs font-medium transition-all cursor-pointer shadow-2xs"
            >
              Làm trống giỏ hàng
            </button>
          </div>
        </div>

        <!-- ========================================================================= -->
        <!-- PHÂN KHU 1: DỊCH VỤ & COMBO LÀM TÓC (CHỈ HIỆN KHI CÓ DỊCH VỤ) -->
        <!-- ========================================================================= -->
        <div v-if="serviceItems.length > 0" class="bg-white rounded-xl border border-neutral-200/80 shadow-2xs p-5 sm:p-6">
          
          <!-- SECTION HEADER (GẠCH CHÂN THANH LỊCH) -->
          <div class="pb-3 mb-4 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <input 
                type="checkbox" 
                :checked="isAllServicesSelected && serviceItems.length > 0" 
                @change="toggleAllServices" 
                class="w-4 h-4 rounded border-neutral-300 text-black accent-black focus:ring-black cursor-pointer" 
                title="Chọn tất cả dịch vụ"
              />
              <div class="flex items-center gap-2">
                <h2 class="text-sm sm:text-base font-heading uppercase tracking-widest text-neutral-900 font-semibold m-0">
                  Dịch Vụ & Combo Làm Tóc
                </h2>
                <span class="text-xs text-neutral-400 font-normal">({{ serviceItems.length }})</span>
              </div>
            </div>

            <router-link 
              :to="{ name: 'dmdv' }" 
              class="text-xs font-medium text-neutral-500 hover:text-black transition-colors underline underline-offset-4"
            >
              + Thêm dịch vụ khác
            </router-link>
          </div>

          <!-- SERVICES CONTENT -->
          <div>
            <!-- Desktop Table Column Titles -->
            <div class="hidden md:grid grid-cols-[32px_4.5fr_1.8fr_1.8fr_40px] gap-4 items-center pb-2.5 mb-2 border-b border-neutral-100 text-[11px] font-heading uppercase tracking-wider text-neutral-400">
              <span></span>
              <span>Dịch vụ & Combo</span>
              <span class="text-center">Thời lượng ước tính</span>
              <span class="text-right">Đơn giá</span>
              <span class="text-center">Xóa</span>
            </div>

            <!-- Service Items List -->
            <div class="divide-y divide-neutral-100">
              <div 
                v-for="item in serviceItems" 
                :key="item.id"
                class="py-3.5 flex flex-col md:grid md:grid-cols-[32px_4.5fr_1.8fr_1.8fr_40px] gap-4 items-center transition-colors rounded-lg px-2 -mx-2"
                :class="isServiceSelected(item.id) ? 'bg-neutral-50/70' : 'hover:bg-neutral-50/40'"
              >
                <!-- Checkbox -->
                <div class="flex items-center self-start md:self-center">
                  <input 
                    type="checkbox" 
                    :checked="isServiceSelected(item.id)" 
                    @change="toggleService(item.id)" 
                    class="w-4 h-4 rounded border-neutral-300 text-black accent-black focus:ring-black cursor-pointer" 
                  />
                </div>

                <!-- Info -->
                <div class="flex items-center gap-3.5 w-full min-w-0">
                  <router-link :to="getServiceLink(item)" class="w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden bg-neutral-100 border border-neutral-200 shrink-0 relative block group">
                    <img 
                      :src="getImageUrl(item.hinhAnh)" 
                      :alt="item.tenItem" 
                      class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy" 
                    />
                    <span 
                      class="absolute bottom-0.5 left-0.5 px-1 py-0.2 rounded text-[7px] font-bold uppercase tracking-wider text-white"
                      :class="item.type === 'COMBO' ? 'bg-amber-600' : 'bg-black'"
                    >
                      {{ item.type === 'COMBO' ? 'COMBO' : 'DV' }}
                    </span>
                  </router-link>

                  <div class="flex-1 min-w-0">
                    <router-link :to="getServiceLink(item)" class="text-xs sm:text-sm font-medium text-neutral-900 m-0 mb-1 leading-snug line-clamp-2 hover:text-neutral-600 transition-colors block">
                      {{ item.tenItem }}
                    </router-link>

                    <!-- Mobile Duration & Price -->
                    <div class="md:hidden flex items-center justify-between gap-2 mt-1.5">
                      <div class="flex items-center gap-1 text-[11px] text-neutral-500">
                        <Clock :size="11" class="text-neutral-400" />
                        <span>{{ item.duration || 30 }} phút</span>
                      </div>
                      <div class="text-sm font-semibold text-neutral-900">
                        {{ formatMoney(item.gia) }}
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Desktop Duration -->
                <div class="hidden md:flex justify-center items-center">
                  <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded bg-neutral-100 text-neutral-700 text-xs font-normal">
                    <Clock :size="11" class="text-neutral-400" /> {{ item.duration || 30 }} phút
                  </span>
                </div>

                <!-- Desktop Price -->
                <div class="hidden md:flex flex-col items-end justify-center text-right w-full">
                  <span v-if="item.giaGoc && item.giaGoc > item.gia" class="text-[11px] text-neutral-400 line-through mb-0.5">
                    {{ formatMoney(item.giaGoc) }}
                  </span>
                  <span class="text-sm font-semibold text-neutral-900">
                    {{ formatMoney(item.gia) }}
                  </span>
                </div>

                <!-- Delete Button (Có Border & Background) -->
                <div class="flex justify-end w-full md:w-auto">
                  <button 
                    @click="removeService(item)" 
                    class="w-8 h-8 rounded-lg border border-neutral-200 bg-white hover:bg-red-50 hover:border-red-200 text-neutral-400 hover:text-red-600 flex items-center justify-center transition-all shadow-2xs cursor-pointer group"
                    title="Xóa dịch vụ"
                  >
                    <Trash2 :size="14" class="transition-colors group-hover:text-red-600" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Subtotal Dịch vụ Bar (KÈM TỔNG THỜI GIAN ƯỚC TÍNH) -->
            <div class="mt-4 pt-3 border-t border-neutral-100 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div class="flex flex-wrap items-center gap-3">
                <span class="text-neutral-500">
                  Đã chọn: <b class="text-neutral-900 font-semibold">{{ selectedServicesCount }}</b> / {{ serviceItems.length }} dịch vụ
                </span>
                <span v-if="selectedServicesCount > 0" class="text-neutral-300">|</span>
                <span v-if="selectedServicesCount > 0" class="text-neutral-600 flex items-center gap-1.5 font-medium">
                  <Clock :size="12" class="text-neutral-400" />
                  Tổng thời gian: <b class="text-neutral-950 font-bold">{{ formatDuration(selectedServicesDuration) }}</b>
                </span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-neutral-500">Tiền dịch vụ:</span>
                <span class="text-sm font-bold text-neutral-950">{{ formatMoney(selectedServicesTotal) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ========================================================================= -->
        <!-- PHÂN KHU 2: SẢN PHẨM CHĂM SÓC TÓC (CHỈ HIỆN KHI CÓ SẢN PHẨM) -->
        <!-- ========================================================================= -->
        <div v-if="productItems.length > 0" class="bg-white rounded-xl border border-neutral-200/80 shadow-2xs p-5 sm:p-6">
          
          <!-- SECTION HEADER (GẠCH CHÂN THANH LỊCH) -->
          <div class="pb-3 mb-4 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <input 
                type="checkbox" 
                :checked="isAllProductsSelected && productItems.length > 0" 
                @change="toggleAllProducts" 
                class="w-4 h-4 rounded border-neutral-300 text-black accent-black focus:ring-black cursor-pointer" 
                title="Chọn tất cả sản phẩm"
              />
              <div class="flex items-center gap-2">
                <h2 class="text-sm sm:text-base font-heading uppercase tracking-widest text-neutral-900 font-semibold m-0">
                  Sản Phẩm Chăm Sóc Tóc
                </h2>
                <span class="text-xs text-neutral-400 font-normal">({{ productItems.length }})</span>
              </div>
            </div>

            <router-link 
              :to="{ name: 'shop' }" 
              class="text-xs font-medium text-neutral-500 hover:text-black transition-colors underline underline-offset-4"
            >
              + Thêm sản phẩm khác
            </router-link>
          </div>

          <!-- PRODUCTS CONTENT -->
          <div>
            <!-- Desktop Table Header (6 CỘT CHUẨN XÁC) -->
            <div class="hidden md:grid grid-cols-[32px_4fr_1.5fr_1.5fr_1.5fr_40px] gap-4 items-center pb-2.5 mb-2 border-b border-neutral-100 text-[11px] font-heading uppercase tracking-wider text-neutral-400">
              <span></span>
              <span>Tên Sản Phẩm</span>
              <span class="text-center">Đơn giá</span>
              <span class="text-center">Số lượng</span>
              <span class="text-right">Thành tiền</span>
              <span class="text-center">Xóa</span>
            </div>

            <!-- Product Items List -->
            <div class="divide-y divide-neutral-100">
              <div 
                v-for="item in productItems" 
                :key="item.id"
                class="py-3.5 flex flex-col md:grid md:grid-cols-[32px_4fr_1.5fr_1.5fr_1.5fr_40px] gap-4 items-center transition-colors rounded-lg px-2 -mx-2"
                :class="isProductSelected(item.id) ? 'bg-neutral-50/70' : 'hover:bg-neutral-50/40'"
              >
                <!-- Cột 1: Checkbox -->
                <div class="flex items-center self-start md:self-center">
                  <input 
                    type="checkbox" 
                    :checked="isProductSelected(item.id)" 
                    @change="toggleProduct(item.id)" 
                    class="w-4 h-4 rounded border-neutral-300 text-black accent-black focus:ring-black cursor-pointer" 
                  />
                </div>

                <!-- Cột 2: Info (Tên Sản Phẩm + Phân Loại Tag + Tồn Kho) -->
                <div class="flex items-center gap-3.5 w-full min-w-0">
                  <router-link :to="getProductLink(item)" class="w-14 h-14 sm:w-16 sm:h-16 rounded-lg overflow-hidden bg-neutral-100 border border-neutral-200 shrink-0 block group">
                    <img 
                      :src="getImageUrl(item.hinhAnh)" 
                      :alt="item.tenSp || item.tenItem" 
                      class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy" 
                    />
                  </router-link>

                  <div class="flex-1 min-w-0">
                    <router-link :to="getProductLink(item)" class="text-xs sm:text-sm font-medium text-neutral-900 m-0 mb-1 leading-snug line-clamp-2 hover:text-neutral-600 transition-colors block">
                      {{ item.tenSp || item.tenItem }}
                    </router-link>

                    <!-- Phân loại & Tồn kho Tags -->
                    <div class="flex flex-wrap items-center gap-2 mt-1">
                      <span v-if="item.tenBienThe && item.tenBienThe !== item.tenSp" class="inline-flex items-center px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700 text-[10px] font-medium border border-neutral-200/60">
                        Phân loại: {{ item.tenBienThe }}
                      </span>
                      <span v-if="item.soLuongTon !== undefined" class="text-[10px] text-neutral-500">
                        Tồn kho: <b class="text-neutral-700">{{ item.soLuongTon }}</b>
                      </span>
                    </div>

                    <!-- Mobile Quantity & Price -->
                    <div class="md:hidden flex items-center justify-between gap-2 mt-2 pt-2 border-t border-neutral-100">
                      <div>
                        <span v-if="item.giaGoc && item.giaGoc > item.gia" class="text-[11px] text-neutral-400 line-through block">
                          {{ formatMoney(item.giaGoc) }}
                        </span>
                        <span class="text-sm font-semibold text-neutral-900">
                          {{ formatMoney(item.gia * (item.soLuong || 1)) }}
                        </span>
                      </div>

                      <div class="flex items-center border border-neutral-300 rounded bg-white overflow-hidden">
                        <button @click="decreaseQuantity(item)" class="w-6 h-6 flex items-center justify-center text-neutral-600 hover:bg-neutral-100 cursor-pointer"><Minus :size="11" /></button>
                        <input 
                          type="number" 
                          v-model.number="item.soLuong" 
                          @change="onQuantityChange(item)"
                          @blur="onQuantityBlur(item)"
                          class="w-7 text-center font-semibold text-xs outline-none bg-transparent hide-arrows" 
                          min="1"
                        />
                        <button @click="increaseQuantity(item)" class="w-6 h-6 flex items-center justify-center text-neutral-600 hover:bg-neutral-100 cursor-pointer"><Plus :size="11" /></button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Cột 3: Đơn giá Desktop -->
                <div class="hidden md:flex flex-col items-center justify-center text-center">
                  <span v-if="item.giaGoc && item.giaGoc > item.gia" class="text-[11px] text-neutral-400 line-through mb-0.5">
                    {{ formatMoney(item.giaGoc) }}
                  </span>
                  <span class="text-xs font-medium text-neutral-700">
                    {{ formatMoney(item.gia) }}
                  </span>
                </div>

                <!-- Cột 4: Số lượng Desktop (+/-) -->
                <div class="hidden md:flex justify-center items-center">
                  <div class="flex items-center border border-neutral-300 rounded bg-white overflow-hidden shadow-2xs">
                    <button 
                      @click="decreaseQuantity(item)" 
                      class="w-7 h-7 flex items-center justify-center text-neutral-600 hover:bg-neutral-100 transition-colors cursor-pointer"
                      title="Giảm số lượng"
                    >
                      <Minus :size="11" />
                    </button>
                    <input 
                      type="number" 
                      v-model.number="item.soLuong" 
                      @change="onQuantityChange(item)"
                      @blur="onQuantityBlur(item)"
                      class="w-8 text-center font-semibold text-xs outline-none bg-transparent hide-arrows text-neutral-900" 
                      min="1"
                    />
                    <button 
                      @click="increaseQuantity(item)" 
                      class="w-7 h-7 flex items-center justify-center text-neutral-600 hover:bg-neutral-100 transition-colors cursor-pointer"
                      title="Tăng số lượng"
                    >
                      <Plus :size="11" />
                    </button>
                  </div>
                </div>

                <!-- Cột 5: Thành tiền Desktop -->
                <div class="hidden md:flex flex-col items-end justify-center text-right w-full">
                  <span class="text-sm font-bold text-neutral-950">
                    {{ formatMoney((item.gia || 0) * (item.soLuong || 1)) }}
                  </span>
                </div>

                <!-- Cột 6: Nút Xóa Desktop (Có Border & Background) -->
                <div class="flex justify-end w-full md:w-auto">
                  <button 
                    @click="removeProduct(item)" 
                    class="w-8 h-8 rounded-lg border border-neutral-200 bg-white hover:bg-red-50 hover:border-red-200 text-neutral-400 hover:text-red-600 flex items-center justify-center transition-all shadow-2xs cursor-pointer group"
                    title="Xóa sản phẩm"
                  >
                    <Trash2 :size="14" class="transition-colors group-hover:text-red-600" />
                  </button>
                </div>
              </div>
            </div>

            <!-- Subtotal Sản phẩm Bar -->
            <div class="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between text-xs">
              <span class="text-neutral-500">
                Đã chọn: <b class="text-neutral-900 font-semibold">{{ selectedProductsCount }}</b> / {{ productItems.length }} sản phẩm
              </span>
              <div class="flex items-center gap-2">
                <span class="text-neutral-500">Tiền sản phẩm:</span>
                <span class="text-sm font-bold text-neutral-950">{{ formatMoney(selectedProductsTotal) }}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- ========================================================================= -->
    <!-- 3. FIXED BOTTOM CHECKOUT BAR -->
    <!-- ========================================================================= -->
    <div 
      v-if="serviceItems.length > 0 || productItems.length > 0"
      class="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-neutral-200/90 shadow-[0_-8px_30px_rgba(0,0,0,0.08)] py-3 px-4 sm:px-8"
    >
      <div class="max-w-[1240px] mx-auto flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        
        <!-- Left: Checkbox Chọn tất cả & Phím tắt Xóa -->
        <div class="flex items-center justify-between sm:justify-start gap-4">
          <label class="flex items-center gap-2.5 cursor-pointer select-none group">
            <input 
              type="checkbox" 
              :checked="isAllSelected" 
              @change="toggleAll" 
              class="w-4 h-4 rounded border-neutral-300 text-black accent-black focus:ring-black cursor-pointer" 
            />
            <span class="text-xs sm:text-sm font-semibold text-neutral-900 group-hover:text-black">
              Chọn tất cả ({{ totalItemCount }})
            </span>
          </label>

          <button 
            v-if="totalSelectedCount > 0"
            @click="removeSelectedItems"
            class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 text-xs font-medium transition-all cursor-pointer"
          >
            <Trash2 :size="12" /> Xóa ({{ totalSelectedCount }})
          </button>
        </div>

        <!-- Right: Chi tiết tổng tiền & Nút Mua Hàng -->
        <div class="flex items-center justify-between md:justify-end gap-5">
          <!-- Breakdown -->
          <div class="text-right">
            <div class="flex items-baseline justify-end gap-2">
              <span class="text-[11px] sm:text-xs text-neutral-500 font-normal">
                Tổng thanh toán ({{ totalSelectedCount }} mục):
              </span>
              <span class="text-lg sm:text-xl font-bold text-neutral-900 tracking-tight">
                {{ formatMoney(grandTotal) }}
              </span>
            </div>

            <div v-if="totalSavings > 0" class="text-[10px] text-emerald-600 font-semibold mt-0.5">
              Tiết kiệm: -{{ formatMoney(totalSavings) }}
            </div>
          </div>

          <!-- Nút ĐẶT LỊCH / MUA HÀNG -->
          <button 
            @click="handleCheckout"
            :disabled="totalSelectedCount === 0 || isProceeding"
            class="flex items-center justify-center gap-2.5 px-7 h-[44px] bg-black hover:bg-neutral-800 text-white rounded-lg font-semibold text-xs uppercase tracking-wider shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <span v-if="isProceeding">Đang xử lý...</span>
            <template v-else>
              <span>{{ checkoutButtonLabel }}</span>
              <ArrowRight :size="14" :stroke-width="2" />
            </template>
          </button>
        </div>

      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { 
  X, 
  Minus, 
  Plus, 
  ArrowRight, 
  Clock, 
  ShoppingBag, 
  Trash2, 
  AlertCircle 
} from 'lucide-vue-next';
import axios from 'axios';
import Swal from 'sweetalert2';
import { useRouter } from "vue-router";
import {
    getCartDB,
    removeFromCartDB,
    clearCartDB,
    updateCartItemDB
} from "@/Views/Anonymous/CSDL/cartDB";
import { getCustomerInfo } from "@/Views/Anonymous/CSDL/DuLieuNguoiDung";
import { useAuthStore } from "@/stores/useAuthStore";
import { useBookingBasketStore } from "@/stores/useBookingBasketStore";

const router = useRouter();
const authStore = useAuthStore();
const bookingBasketStore = useBookingBasketStore();

interface ServiceItem {
    id: string | number;
    type: 'DICHVU' | 'COMBO';
    tenItem: string;
    gia: number;
    giaGoc?: number;
    duration?: number;
    hinhAnh?: string;
}

interface ProductItem {
    id: string | number;
    type?: 'SANPHAM' | 'BIENTHE';
    tenSp?: string;
    tenBienThe?: string;
    tenItem: string;
    gia: number;
    giaGoc?: number;
    hinhAnh?: string;
    soLuong?: number;
    soLuongTon?: number;
}

const isLoading = ref(true);
const isProceeding = ref(false);
const serviceItems = ref<ServiceItem[]>([]);
const productItems = ref<ProductItem[]>([]);

const selectedServiceIds = ref<Set<string>>(new Set());
const selectedProductIds = ref<Set<string>>(new Set());

const isSessionExpired = computed({
    get: () => authStore.sessionExpiredBanner,
    set: (val: boolean) => authStore.setSessionExpiredBanner(val)
});
const isLoggedIn = ref(false);
const defaultImage = "/images/no-image.png";
let stockPollingTimer: any = null;

const API = import.meta.env.VITE_API_URL || 'https://localhost:7196';

const getImageUrl = (url: string | undefined | null) => {
    if (!url) return defaultImage;
    if (url.startsWith('http')) return url;
    if (url.startsWith('/images/') && !url.includes('upload')) return url;
    return `${API}${url.startsWith('/') ? '' : '/'}${url}`;
};

const formatMoney = (money: number) => {
    return new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND"
    }).format(money || 0);
};

const formatDuration = (mins: number) => {
    if (!mins || mins <= 0) return '0 phút';
    const hours = Math.floor(mins / 60);
    const remainMins = mins % 60;
    if (hours > 0 && remainMins > 0) {
        return `${hours} giờ ${remainMins} phút`;
    } else if (hours > 0) {
        return `${hours} giờ`;
    }
    return `${mins} phút`;
};

// =====================================================================
// HELPER ROUTER LINKS CHUẨN XÁC
// =====================================================================
const getServiceLink = (item: ServiceItem) => {
    if (item.type === 'COMBO') {
        return { name: 'detailCombo', params: { id: item.id } };
    }
    return { name: 'serviceDetail', params: { id: item.id } };
};

const getProductLink = (item: ProductItem) => {
    return { name: 'product_detail', params: { id: item.id } };
};

// =====================================================================
// NẠP VÀ LÀM GIÀU DỮ LIỆU SẢN PHẨM & DỊCH VỤ
// =====================================================================
const loadCart = async () => {
    try {
        const maKH = getCustomerInfo().maKH;
        const allDbItems = await getCartDB(maKH);

        const products: ProductItem[] = [];
        const dbServices: ServiceItem[] = [];

        (allDbItems || []).forEach((item: any) => {
            if (item.type === 'SANPHAM' || item.type === 'BIENTHE') {
                let tenSp = item.tenSp || '';
                let tenBienThe = item.tenBienThe || item.ten || '';
                let fullTitle = item.tenItem || item.ten || 'Sản phẩm';

                if (!tenSp && fullTitle.includes(' - ')) {
                    const parts = fullTitle.split(' - ');
                    tenSp = parts[0];
                    tenBienThe = parts.slice(1).join(' - ');
                }

                products.push({
                    id: item.id,
                    type: item.type,
                    tenSp: tenSp || fullTitle,
                    tenBienThe: tenBienThe,
                    tenItem: fullTitle,
                    gia: Number(item.gia || 0),
                    giaGoc: Number(item.giaGoc || item.gia || 0),
                    hinhAnh: item.hinhAnh,
                    soLuong: Number(item.soLuong || 1),
                    soLuongTon: item.soLuongTon
                });
            } else if (item.type === 'DICHVU' || item.type === 'COMBO') {
                dbServices.push({
                    id: item.id,
                    type: item.type,
                    tenItem: item.tenItem || item.ten || 'Dịch vụ',
                    gia: Number(item.gia || 0),
                    giaGoc: Number(item.giaGoc || item.gia || 0),
                    duration: Number(item.duration || item.thoiGianLam || 30),
                    hinhAnh: item.hinhAnh
                });
            }
        });

        const basketServices: ServiceItem[] = (bookingBasketStore.items || []).map(item => ({
            id: item.id,
            type: item.type,
            tenItem: item.tenItem,
            gia: Number(item.gia || 0),
            giaGoc: Number(item.giaGoc || item.gia || 0),
            duration: Number(item.duration || 30),
            hinhAnh: item.hinhAnh
        }));

        const mergedServiceMap = new Map<string, ServiceItem>();
        [...dbServices, ...basketServices].forEach(s => {
            mergedServiceMap.set(String(s.id), s);
        });

        serviceItems.value = Array.from(mergedServiceMap.values());
        productItems.value = products;

        enrichProductDetails();
    } catch (error) {
        console.error("Lỗi tải giỏ hàng:", error);
    } finally {
        isLoading.value = false;
    }
};

const enrichProductDetails = async () => {
    try {
        const res = await axios.get(`${API}/api/ThanhToanSanPham/search-products-variants`, {
            params: { keyword: '' }
        });
        if (res.data && res.data.success && Array.isArray(res.data.data)) {
            const allProducts = res.data.data;
            productItems.value.forEach(p => {
                for (const sp of allProducts) {
                    const bt = sp.bienthes?.find((b: any) => String(b.maBienThe) === String(p.id));
                    if (bt) {
                        p.tenSp = sp.tenSp;
                        p.tenBienThe = bt.tenBienThe;
                        p.tenItem = `${sp.tenSp} - ${bt.tenBienThe}`;
                        if (bt.soLuongTon !== undefined) {
                            p.soLuongTon = bt.soLuongTon;
                        }
                        if (!p.hinhAnh || p.hinhAnh.includes('no-image')) {
                            p.hinhAnh = bt.hinhAnhDaiDien || bt.hinhAnh || sp.hinhAnhDaiDien;
                        }
                        break;
                    }
                }
            });
        }
    } catch {
        // Im lặng nếu API phụ không khả dụng
    }
};

const isServiceSelected = (id: string | number) => selectedServiceIds.value.has(String(id));
const isProductSelected = (id: string | number) => selectedProductIds.value.has(String(id));

const toggleService = (id: string | number) => {
    const key = String(id);
    if (selectedServiceIds.value.has(key)) {
        selectedServiceIds.value.delete(key);
    } else {
        selectedServiceIds.value.add(key);
    }
    selectedServiceIds.value = new Set(selectedServiceIds.value);
};

const toggleProduct = (id: string | number) => {
    const key = String(id);
    if (selectedProductIds.value.has(key)) {
        selectedProductIds.value.delete(key);
    } else {
        selectedProductIds.value.add(key);
    }
    selectedProductIds.value = new Set(selectedProductIds.value);
};

const isAllServicesSelected = computed(() => {
    if (serviceItems.value.length === 0) return false;
    return serviceItems.value.every(s => selectedServiceIds.value.has(String(s.id)));
});

const isAllProductsSelected = computed(() => {
    if (productItems.value.length === 0) return false;
    return productItems.value.every(p => selectedProductIds.value.has(String(p.id)));
});

const isAllSelected = computed(() => {
    const totalCount = serviceItems.value.length + productItems.value.length;
    if (totalCount === 0) return false;
    const selectedCount = selectedServiceIds.value.size + selectedProductIds.value.size;
    return selectedCount === totalCount;
});

const toggleAllServices = () => {
    if (isAllServicesSelected.value) {
        serviceItems.value.forEach(s => selectedServiceIds.value.delete(String(s.id)));
    } else {
        serviceItems.value.forEach(s => selectedServiceIds.value.add(String(s.id)));
    }
    selectedServiceIds.value = new Set(selectedServiceIds.value);
};

const toggleAllProducts = () => {
    if (isAllProductsSelected.value) {
        productItems.value.forEach(p => selectedProductIds.value.delete(String(p.id)));
    } else {
        productItems.value.forEach(p => selectedProductIds.value.add(String(p.id)));
    }
    selectedProductIds.value = new Set(selectedProductIds.value);
};

const toggleAll = () => {
    if (isAllSelected.value) {
        selectedServiceIds.value.clear();
        selectedProductIds.value.clear();
    } else {
        serviceItems.value.forEach(s => selectedServiceIds.value.add(String(s.id)));
        productItems.value.forEach(p => selectedProductIds.value.add(String(p.id)));
    }
    selectedServiceIds.value = new Set(selectedServiceIds.value);
    selectedProductIds.value = new Set(selectedProductIds.value);
};

const totalItemCount = computed(() => serviceItems.value.length + productItems.value.length);
const selectedServicesCount = computed(() => selectedServiceIds.value.size);
const selectedProductsCount = computed(() => selectedProductIds.value.size);
const totalSelectedCount = computed(() => selectedServicesCount.value + selectedProductsCount.value);

const selectedServicesList = computed(() => {
    return serviceItems.value.filter(s => selectedServiceIds.value.has(String(s.id)));
});

const selectedProductsList = computed(() => {
    return productItems.value.filter(p => selectedProductIds.value.has(String(p.id)));
});

const selectedServicesDuration = computed(() => {
    return selectedServicesList.value.reduce((sum, item) => sum + Number(item.duration || 30), 0);
});

const selectedServicesTotal = computed(() => {
    return selectedServicesList.value.reduce((sum, item) => sum + Number(item.gia || 0), 0);
});

const selectedProductsTotal = computed(() => {
    return selectedProductsList.value.reduce((sum, item) => {
        return sum + Number(item.gia || 0) * Number(item.soLuong || 1);
    }, 0);
});

const grandTotal = computed(() => selectedServicesTotal.value + selectedProductsTotal.value);

const totalSavings = computed(() => {
    const origServices = selectedServicesList.value.reduce((sum, item) => sum + Number(item.giaGoc || item.gia || 0), 0);
    const origProducts = selectedProductsList.value.reduce((sum, item) => {
        return sum + Number(item.giaGoc || item.gia || 0) * Number(item.soLuong || 1);
    }, 0);
    return Math.max(0, (origServices + origProducts) - grandTotal.value);
});

const checkoutButtonLabel = computed(() => {
    if (selectedServicesCount.value > 0 && selectedProductsCount.value === 0) {
        return `ĐẶT LỊCH NGAY (${selectedServicesCount.value})`;
    }
    if (selectedServicesCount.value === 0 && selectedProductsCount.value > 0) {
        return `MUA SẢN PHẨM (${selectedProductsCount.value})`;
    }
    if (selectedServicesCount.value > 0 && selectedProductsCount.value > 0) {
        return `THANH TOÁN TỔNG HỢP (${totalSelectedCount.value})`;
    }
    return `MUA HÀNG (0)`;
});

const removeService = async (item: ServiceItem) => {
    selectedServiceIds.value.delete(String(item.id));
    selectedServiceIds.value = new Set(selectedServiceIds.value);
    
    bookingBasketStore.removeItem(item.id);
    await removeFromCartDB(item.id, item.type);
    
    await loadCart();
    window.dispatchEvent(new Event('cart-updated'));
    window.dispatchEvent(new Event('booking-basket-updated'));
};

const removeProduct = async (item: ProductItem) => {
    selectedProductIds.value.delete(String(item.id));
    selectedProductIds.value = new Set(selectedProductIds.value);

    await removeFromCartDB(item.id, 'SANPHAM');
    await loadCart();
    window.dispatchEvent(new Event('cart-updated'));
};

const removeSelectedItems = async () => {
    if (totalSelectedCount.value === 0) return;

    const result = await Swal.fire({
        title: 'Xác nhận xóa mục đã chọn?',
        text: `Bạn có chắc muốn xóa ${totalSelectedCount.value} mục đang chọn khỏi giỏ hàng?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#000',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Xác nhận xóa',
        cancelButtonText: 'Hủy'
    });

    if (result.isConfirmed) {
        for (const s of selectedServicesList.value) {
            bookingBasketStore.removeItem(s.id);
            await removeFromCartDB(s.id, s.type);
        }
        for (const p of selectedProductsList.value) {
            await removeFromCartDB(p.id, 'SANPHAM');
        }

        selectedServiceIds.value.clear();
        selectedProductIds.value.clear();
        selectedServiceIds.value = new Set();
        selectedProductIds.value = new Set();

        await loadCart();
        window.dispatchEvent(new Event('cart-updated'));
        window.dispatchEvent(new Event('booking-basket-updated'));
    }
};

const confirmClearAll = async () => {
    const result = await Swal.fire({
        title: 'Làm trống giỏ hàng?',
        text: 'Toàn bộ dịch vụ và sản phẩm trong giỏ hàng sẽ bị xóa!',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#000',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Làm trống ngay',
        cancelButtonText: 'Hủy'
    });

    if (result.isConfirmed) {
        const maKH = getCustomerInfo().maKH;
        await clearCartDB(maKH);
        bookingBasketStore.clearAll();

        selectedServiceIds.value.clear();
        selectedProductIds.value.clear();
        selectedServiceIds.value = new Set();
        selectedProductIds.value = new Set();

        await loadCart();
        window.dispatchEvent(new Event('cart-updated'));
        window.dispatchEvent(new Event('booking-basket-updated'));
    }
};

const increaseQuantity = async (item: ProductItem) => {
    if (typeof item.soLuongTon === 'number' && Number(item.soLuong || 1) >= item.soLuongTon) {
        Swal.fire({
            icon: 'warning',
            title: 'Số lượng tồn kho',
            text: `Chỉ còn ${item.soLuongTon} sản phẩm trong kho!`,
            confirmButtonColor: '#000'
        });
        return;
    }

    item.soLuong = Number(item.soLuong || 1) + 1;
    try {
        await updateCartItemDB(item as any);
    } catch {
        await loadCart();
    }
};

const decreaseQuantity = async (item: ProductItem) => {
    const currentQuantity = Number(item.soLuong || 1);
    if (currentQuantity <= 1) {
        await removeProduct(item);
        return;
    }
    item.soLuong = currentQuantity - 1;
    try {
        await updateCartItemDB(item as any);
    } catch {
        await loadCart();
    }
};

const onQuantityChange = async (item: ProductItem) => {
    let newQty = Number(item.soLuong);
    if (isNaN(newQty) || newQty < 1) newQty = 1;

    if (typeof item.soLuongTon === 'number' && newQty > item.soLuongTon) {
        newQty = item.soLuongTon;
        Swal.fire({
            icon: 'warning',
            title: 'Vượt quá tồn kho',
            text: `Chỉ còn ${item.soLuongTon} sản phẩm trong kho!`,
            confirmButtonColor: '#000'
        });
    }

    item.soLuong = newQty;
    try {
        await updateCartItemDB(item as any);
    } catch {
        await loadCart();
    }
};

const onQuantityBlur = (item: ProductItem) => {
    if (!item.soLuong || item.soLuong < 1) {
        item.soLuong = 1;
        onQuantityChange(item);
    }
};

// =====================================================================
// ĐIỀU HƯỚNG THANH TOÁN THÔNG MINH
// =====================================================================
const handleCheckout = () => {
    if (totalSelectedCount.value === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Chưa chọn mục nào',
            text: 'Vui lòng tích chọn ít nhất 1 dịch vụ hoặc 1 sản phẩm để thanh toán!',
            confirmButtonColor: '#000'
        });
        return;
    }

    isProceeding.value = true;
    const maKH = getCustomerInfo().maKH || 'GUEST';

    const selectedServices = selectedServicesList.value;
    const selectedProducts = selectedProductsList.value;

    const hasServices = selectedServices.length > 0;
    const hasProducts = selectedProducts.length > 0;

    let loaiCheckout = 'CHI_MUA_SAN_PHAM';
    if (hasServices && hasProducts) {
        loaiCheckout = 'DAT_LICH_VA_MUA_SAN_PHAM';
    } else if (hasServices && !hasProducts) {
        loaiCheckout = 'CHI_DAT_LICH';
    }

    const payload = {
        maKH: maKH,
        loaiCheckout: loaiCheckout,
        dichVuItems: selectedServices.map(item => ({
            id: item.id,
            tenItem: item.tenItem,
            gia: item.gia,
            giaGoc: item.giaGoc || item.gia,
            duration: item.duration || 30,
            hinhAnh: item.hinhAnh,
            type: item.type
        })),
        sanPhamItems: selectedProducts.map(item => ({
            id: item.id,
            tenItem: item.tenItem,
            gia: item.gia,
            giaGoc: item.giaGoc || item.gia,
            soLuong: item.soLuong || 1,
            hinhAnh: item.hinhAnh
        })),
        nhanSanPham: null,
        tongDichVu: selectedServicesTotal.value,
        tongSanPham: selectedProductsTotal.value,
        tongTien: grandTotal.value
    };

    localStorage.setItem("checkoutData", JSON.stringify(payload));

    if (hasServices) {
        bookingBasketStore.items = selectedServices.map(item => ({
            id: item.id,
            tenItem: item.tenItem,
            gia: item.gia,
            giaGoc: item.giaGoc,
            duration: item.duration || 30,
            hinhAnh: item.hinhAnh,
            type: item.type
        }));
    }

    if (loaiCheckout === 'DAT_LICH_VA_MUA_SAN_PHAM') {
        router.push({ name: 'thanh_toan_tong' });
    } else if (loaiCheckout === 'CHI_DAT_LICH') {
        router.push({ name: 'datdichvu' });
    } else {
        router.push({ name: 'thanh_toan_san_pham' });
    }
};

const checkAndSyncCustomerSession = async () => {
    const token = localStorage.getItem('token') || localStorage.getItem('accessToken');
    const savedUser = localStorage.getItem('user');

    if (token || savedUser) {
        try {
            const res = await axios.get(`${API}/api/account/get-profile`, { withCredentials: true });
            if (res.data?.success && res.data?.user) {
                isLoggedIn.value = true;
                isSessionExpired.value = false;
            }
        } catch (err: any) {
            if (err.response?.status === 401) {
                localStorage.removeItem('user');
                localStorage.removeItem('token');
                localStorage.removeItem('accessToken');
                sessionStorage.removeItem('user');
                sessionStorage.removeItem('token');
                isLoggedIn.value = false;
                isSessionExpired.value = true;
                window.dispatchEvent(new Event('user-updated'));
            }
        }
    } else {
        isLoggedIn.value = false;
    }
    await loadCart();
};

const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') {
        checkAndSyncCustomerSession();
    }
};

onMounted(async () => {
    await checkAndSyncCustomerSession();

    window.addEventListener('user-updated', checkAndSyncCustomerSession);
    window.addEventListener('storage', checkAndSyncCustomerSession);
    window.addEventListener('focus', checkAndSyncCustomerSession);
    window.addEventListener('cart-updated', loadCart);
    window.addEventListener('booking-basket-updated', loadCart);
    document.addEventListener('visibilitychange', onVisibilityChange);
    
    stockPollingTimer = setInterval(async () => {
        try {
            const maKH = getCustomerInfo().maKH;
            const data = await getCartDB(maKH);
            if (data && Array.isArray(data)) {
                data.forEach((serverItem: any) => {
                    const localProduct = productItems.value.find(i => String(i.id) === String(serverItem.id));
                    if (localProduct && typeof serverItem.soLuongTon === 'number') {
                        localProduct.soLuongTon = serverItem.soLuongTon;
                        if (typeof localProduct.soLuong === 'number' && localProduct.soLuong > serverItem.soLuongTon) {
                            localProduct.soLuong = serverItem.soLuongTon;
                        }
                    }
                });
            }
        } catch {}
    }, 20000);
});

onUnmounted(() => {
    if (stockPollingTimer) clearInterval(stockPollingTimer);
    window.removeEventListener('user-updated', checkAndSyncCustomerSession);
    window.removeEventListener('storage', checkAndSyncCustomerSession);
    window.removeEventListener('focus', checkAndSyncCustomerSession);
    window.removeEventListener('cart-updated', loadCart);
    window.removeEventListener('booking-basket-updated', loadCart);
    document.removeEventListener('visibilitychange', onVisibilityChange);
});
</script>

<style scoped>
.hide-arrows::-webkit-inner-spin-button, 
.hide-arrows::-webkit-outer-spin-button { 
  -webkit-appearance: none;
  appearance: none;
  margin: 0; 
}
.hide-arrows {
  -moz-appearance: textfield;
  appearance: textfield;
}
</style>
