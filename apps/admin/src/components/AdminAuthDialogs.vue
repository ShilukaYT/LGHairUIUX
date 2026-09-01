<script setup lang="ts">
import { AlertTriangle, LogOut, Lock } from 'lucide-vue-next';
import { useAdminAuthDialogStore } from '@/stores/adminAuthDialog';

const authDialogStore = useAdminAuthDialogStore();
</script>

<template>
  <div>
    <!-- 1. Hộp thoại Thông Báo Hết Hạn Phiên (Vuetify 3) -->
    <v-dialog
      v-model="authDialogStore.showSessionExpiredDialog"
      max-width="450px"
      persistent
      transition="dialog-transition"
    >
      <v-card class="rounded-2xl pa-6 elevation-12 text-center">
        <v-card-item class="pt-2 pb-2">
          <div class="d-flex justify-center mb-5">
            <div 
              class="d-flex align-center justify-center rounded-circle bg-amber-lighten-5"
              style="width: 76px; height: 76px; min-width: 76px;"
            >
              <AlertTriangle :size="44" class="text-amber-darken-2" :stroke-width="2" />
            </div>
          </div>
          <v-card-title class="text-h5 font-weight-bold pb-2 text-center" style="font-size: 1.35rem !important;">
            Phiên Làm Việc Hết Hạn
          </v-card-title>
        </v-card-item>

        <v-card-text class="text-body-1 px-4 pb-6 pt-1" style="font-size: 16px !important; line-height: 1.6;">
          {{ authDialogStore.sessionExpiredMessage }}
        </v-card-text>

        <v-card-actions class="px-4 pb-2 pt-0">
          <v-btn
            block
            color="primary"
            variant="flat"
            height="48"
            rounded="lg"
            class="text-uppercase font-weight-bold tracking-wider text-subtitle-1"
            @click="authDialogStore.closeSessionExpired"
          >
            Đăng Nhập Lại
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 2. Hộp thoại Xác Nhận Đăng Xuất (Vuetify 3) -->
    <v-dialog
      v-model="authDialogStore.showLogoutConfirmDialog"
      max-width="450px"
      persistent
      transition="dialog-transition"
    >
      <v-card class="rounded-2xl pa-6 elevation-12 text-center">
        <v-card-item class="pt-2 pb-2">
          <div class="d-flex justify-center mb-5">
            <div 
              class="d-flex align-center justify-center rounded-circle bg-red-lighten-5"
              style="width: 76px; height: 76px; min-width: 76px;"
            >
              <LogOut :size="40" class="text-red" :stroke-width="2" />
            </div>
          </div>
          <v-card-title class="text-h5 font-weight-bold pb-2 text-center" style="font-size: 1.35rem !important;">
            Xác Nhận Đăng Xuất
          </v-card-title>
        </v-card-item>

        <v-card-text class="text-body-1 px-4 pb-6 pt-1" style="font-size: 16px !important; line-height: 1.6;">
          Bạn có chắc chắn muốn đăng xuất khỏi phiên làm việc hiện tại trên thiết bị này không?
        </v-card-text>

        <v-card-actions class="px-4 pb-2 pt-0">
          <v-row dense>
            <v-col cols="6">
              <v-btn
                block
                variant="outlined"
                color="secondary"
                height="48"
                rounded="lg"
                class="text-uppercase font-weight-medium text-subtitle-1"
                @click="authDialogStore.closeLogoutConfirm"
              >
                Hủy bỏ
              </v-btn>
            </v-col>
            <v-col cols="6">
              <v-btn
                block
                color="error"
                variant="flat"
                height="48"
                rounded="lg"
                class="text-uppercase font-weight-bold tracking-wider text-subtitle-1"
                @click="authDialogStore.confirmLogout"
              >
                Đăng xuất
              </v-btn>
            </v-col>
          </v-row>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- 3. Hộp thoại Tài Khoản Bị Khóa (Vuetify 3) -->
    <v-dialog
      v-model="authDialogStore.showLockedAccountDialog"
      max-width="480px"
      persistent
      transition="dialog-transition"
    >
      <v-card class="rounded-2xl pa-6 elevation-16 text-center border-sm border-error">
        <v-card-item class="pt-2 pb-2">
          <div class="d-flex justify-center mb-5">
            <div 
              class="d-flex align-center justify-center rounded-circle bg-red-lighten-5"
              style="width: 80px; height: 80px; min-width: 80px; border: 2px solid #ef5350;"
            >
              <Lock :size="44" class="text-red-darken-2" :stroke-width="2" />
            </div>
          </div>
          <v-card-title class="text-h5 font-weight-bold pb-2 text-center text-red-darken-3" style="font-size: 1.35rem !important;">
            Tài Khoản Đã Bị Khóa
          </v-card-title>
        </v-card-item>

        <v-card-text class="text-body-1 px-4 pb-6 pt-1 text-grey-darken-2" style="font-size: 16px !important; line-height: 1.6;">
          {{ authDialogStore.lockedAccountMessage }}
        </v-card-text>

        <v-card-actions class="px-4 pb-2 pt-0">
          <v-btn
            block
            color="error"
            variant="flat"
            height="48"
            rounded="lg"
            class="text-uppercase font-weight-bold tracking-wider text-subtitle-1"
            @click="authDialogStore.closeLockedAccount"
          >
            Quay lại Đăng nhập
          </v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style scoped>
</style>
