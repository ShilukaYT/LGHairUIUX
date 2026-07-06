<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
// icons
import { CheckCircleOutlined, MessageOutlined, BellOutlined } from '@ant-design/icons-vue';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, writeBatch, limit, where, addDoc } from 'firebase/firestore';
import { adminDb } from '@/firebase-admin.js';

const props = defineProps<{
  isAdmin?: boolean;
  currentUserMaNv?: string;
}>();

const notifications = ref<any[]>([]);
const unreadNotifications = computed(() => notifications.value.filter(n => !n.isRead));
const unreadCount = computed(() => unreadNotifications.value.length);
const router = useRouter();

const collectionName = computed(() => props.isAdmin ? 'AdminNotifications' : 'EmployeeNotifications');

onMounted(() => {
  let q;
  if (props.isAdmin) {
    q = query(collection(adminDb, 'AdminNotifications'), orderBy('createdAt', 'desc'), limit(20));
  } else if (props.currentUserMaNv) {
    q = query(
      collection(adminDb, 'EmployeeNotifications'),
      where('maNv', '==', props.currentUserMaNv),
      limit(20)
    );
  } else {
    return;
  }
  
  onSnapshot(q, (snapshot) => {
    let docs = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    // Sort locally to avoid Firebase composite index error
    docs.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return timeB - timeA;
    });
    notifications.value = docs;
  }, (error) => {
    console.error("Firebase Snapshot Error:", error);
  });
});

async function markAsRead(id: string) {
  try {
    await updateDoc(doc(adminDb, collectionName.value, id), { isRead: true });
  } catch (error) {
    console.error("Error marking as read:", error);
  }
}

async function handleNotificationClick(n: any) {
  if (!n.isRead) {
    await markAsRead(n.id);
  }
  isViewAllDialogOpen.value = false;
  if (n.link && props.isAdmin) {
    router.push(n.link);
  }
}

async function markAllAsRead() {
  const unreadDocs = notifications.value.filter(n => !n.isRead);
  if (unreadDocs.length === 0) return;
  
  const batch = writeBatch(adminDb);
  unreadDocs.forEach(n => {
    batch.update(doc(adminDb, collectionName.value, n.id), { isRead: true });
  });
  
  try {
    await batch.commit();
  } catch (error) {
    console.error("Error marking all as read:", error);
  }
}

function formatTime(val: any) {
  if (!val) return '';
  
  let date;
  // Nếu là Firestore Timestamp
  if (val && typeof val.toDate === 'function') {
    date = val.toDate();
  } else {
    // Nếu là chuỗi ISO string
    date = new Date(val);
  }
  
  if (isNaN(date.getTime())) return '';
  return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
}

// ---- REPLY FEATURE ----
const isReplyDialogOpen = ref(false);
const isViewAllDialogOpen = ref(false);
const replyMessage = ref('');
const selectedNotification = ref<any>(null);

function openReplyDialog(n: any, event: Event) {
  event.stopPropagation();
  selectedNotification.value = n;
  replyMessage.value = '';
  isReplyDialogOpen.value = true;
}

async function submitReply() {
  if (!replyMessage.value || !selectedNotification.value) return;
  try {
    await addDoc(collection(adminDb, 'EmployeeNotifications'), {
      maNv: selectedNotification.value.maNv,
      title: 'Phản hồi từ Quản lý',
      description: replyMessage.value,
      isRead: false,
      createdAt: new Date().toISOString(),
      link: ''
    });
    isReplyDialogOpen.value = false;
  } catch(error) {
    console.error("Lỗi gửi phản hồi", error);
  }
}
</script>

<template>
  <div>
    <!-- ---------------------------------------------- -->
    <!-- notifications DD -->
    <!-- ---------------------------------------------- -->
    <v-menu :close-on-content-click="false" offset="6, 0">
      <template v-slot:activator="{ props }">
        <v-btn icon class="text-secondary ml-sm-2 ml-1" color="darkText" rounded="sm" size="small" v-bind="props">
          <v-badge :content="unreadCount" :color="unreadCount > 0 ? 'primary' : 'transparent'" offset-x="-4" offset-y="-5">
            <BellOutlined :style="{ fontSize: '16px' }" />
          </v-badge>
        </v-btn>
      </template>
      <v-sheet rounded="md" width="387" class="notification-dropdown">
        <div class="pa-4">
          <div class="d-flex align-center justify-space-between">
            <h6 class="text-subtitle-1 mb-0">Thông báo</h6>
            <v-btn
              variant="text"
              color="success"
              icon
              rounded
              size="small"
              @click="markAllAsRead"
              :class="unreadCount > 0 ? 'd-block' : 'd-none'"
            >
              <CheckCircleOutlined :style="{ fontSize: '16px' }" />
              <v-tooltip aria-label="tooltip" activator="parent" location="bottom" :content-class="unreadCount > 0 ? 'custom-tooltip' : 'd-none'">
                <span class="text-caption">Đánh dấu tất cả đã đọc</span>
              </v-tooltip>
            </v-btn>
          </div>
        </div>
        <v-divider></v-divider>
        <perfect-scrollbar style="height: calc(100vh - 300px); max-height: 265px">
          <v-list class="py-0" lines="two" aria-label="notification list" aria-busy="true">
            
            <v-list-item v-if="unreadNotifications.length === 0" class="text-center py-4">
              <span class="text-caption text-medium-emphasis">Không có thông báo mới nào</span>
            </v-list-item>

            <template v-for="(n, index) in unreadNotifications" :key="n.id">
              <v-list-item 
                class="no-spacer py-2" 
                :class="n.isRead ? 'opacity-70' : 'bg-lightprimary'"
                @click="handleNotificationClick(n)" 
                style="cursor: pointer;"
              >
                <template v-slot:prepend>
                  <v-avatar size="36" variant="flat" color="lightprimary" class="mr-3 py-2 text-primary">
                    <MessageOutlined />
                  </v-avatar>
                </template>
                
                <div class="d-flex flex-column w-100">
                  <div class="d-inline-flex justify-space-between w-100">
                    <h6 class="text-subtitle-1 mb-0" :class="n.isRead ? 'font-weight-regular' : 'font-weight-bold'" style="white-space: normal; line-height: 1.2;">
                      <span>{{ n.title }}</span>
                    </h6>
                    <span class="text-caption ml-2" style="white-space: nowrap;">{{ formatTime(n.createdAt) }}</span>
                  </div>
                  <p class="text-caption text-medium-emphasis my-1" style="white-space: normal;">{{ n.description }}</p>
                  
                  <div class="text-right mt-1" v-if="props.isAdmin && n.maNv">
                    <v-btn size="x-small" color="primary" variant="tonal" @click="(e) => openReplyDialog(n, e)">
                      Phản hồi
                    </v-btn>
                  </div>
                </div>

              </v-list-item>
              <v-divider v-if="index < unreadNotifications.length - 1"></v-divider>
            </template>

          </v-list>
        </perfect-scrollbar>
        <v-divider></v-divider>
        <div class="pa-2 text-center">
          <v-btn color="primary" variant="text" @click="isViewAllDialogOpen = true">Xem tất cả</v-btn>
        </div>
      </v-sheet>
    </v-menu>

    <!-- View All Dialog -->
    <v-dialog v-model="isViewAllDialogOpen" max-width="500">
      <v-card>
        <v-card-title class="d-flex justify-space-between align-center">
          <span>Tất cả thông báo</span>
          <v-btn icon="mdi-close" variant="text" @click="isViewAllDialogOpen = false" size="small"></v-btn>
        </v-card-title>
        <v-divider></v-divider>
        <v-card-text class="pa-0">
          <v-list lines="two" v-if="notifications.length > 0">
            <template v-for="(n, index) in notifications" :key="'all-'+n.id">
              <v-list-item 
                class="no-spacer py-2" 
                :class="n.isRead ? 'opacity-70' : 'bg-lightprimary'"
                @click="handleNotificationClick(n)" 
                style="cursor: pointer;"
              >
                <template v-slot:prepend>
                  <v-avatar size="36" variant="flat" color="lightprimary" class="mr-3 py-2 text-primary">
                    <MessageOutlined />
                  </v-avatar>
                </template>
                
                <div class="d-flex flex-column w-100">
                  <div class="d-inline-flex justify-space-between w-100">
                    <h6 class="text-subtitle-1 mb-0" :class="n.isRead ? 'font-weight-regular' : 'font-weight-bold'" style="white-space: normal; line-height: 1.2;">
                      <span>{{ n.title }}</span>
                    </h6>
                    <span class="text-caption ml-2" style="white-space: nowrap;">{{ formatTime(n.createdAt) }}</span>
                  </div>
                  <p class="text-caption text-medium-emphasis my-1" style="white-space: normal;">{{ n.description }}</p>
                  
                  <div class="text-right mt-1" v-if="props.isAdmin && n.maNv">
                    <v-btn size="x-small" color="primary" variant="tonal" @click="(e) => openReplyDialog(n, e)">
                      Phản hồi
                    </v-btn>
                  </div>
                </div>
              </v-list-item>
              <v-divider v-if="index < notifications.length - 1"></v-divider>
            </template>
          </v-list>
          <div v-else class="text-center py-6 text-medium-emphasis">
            Không có thông báo nào trong hệ thống
          </div>
        </v-card-text>
        <v-divider></v-divider>
        <v-card-actions class="justify-end">
          <v-btn color="primary" variant="text" @click="isViewAllDialogOpen = false">Đóng</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <!-- Reply Dialog -->
    <v-dialog v-model="isReplyDialogOpen" max-width="400">
      <v-card>
        <v-card-title>Phản hồi nhân viên</v-card-title>
        <v-card-text>
          <v-textarea v-model="replyMessage" label="Nội dung tin nhắn" rows="3" variant="outlined" hide-details></v-textarea>
        </v-card-text>
        <v-card-actions class="justify-end pb-4 pr-4">
          <v-btn color="error" variant="text" @click="isReplyDialogOpen = false">Hủy</v-btn>
          <v-btn color="primary" variant="elevated" @click="submitReply">Gửi</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<style lang="scss">
.v-tooltip {
  > .v-overlay__content.custom-tooltip {
    padding: 2px 6px;
  }
}
</style>
