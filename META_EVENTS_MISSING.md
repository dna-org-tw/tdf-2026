# Meta 标准事件遗漏检查报告

本文档列出了网站中可能遗漏的 Meta (Facebook Pixel) 标准事件。

## 遗漏的标准事件

### 1. SubmitApplication（提交申请）

**状态**: ❌ **未实现**

**说明**: 网站有多个"Call for"链接，这些链接指向 Google Forms 申请表单。当用户点击这些链接时，应该追踪 `SubmitApplication` 事件，但目前只追踪了 `Lead` 事件。

**适用场景**:
- Call for Speakers (https://forms.gle/pVc6oTEi1XZ1pAR49)
- Call for Volunteers (https://forms.gle/SPCggMHifbE3oqkk7)
- Call for Partners (https://forms.gle/KqJGkQhdWmSZVTdv6)
- Call for Side Events (https://forms.gle/EofTp9Qso27jEeeY7)
- Call for Sponsors (https://forms.gle/aN3LbaHy8iV5xqyi8)

**当前实现位置**:
- `components/sections/HeroSection.tsx` - 所有 Call for 链接
- `components/Footer.tsx` - 所有 Call for 链接
- `components/sections/EventsSection.tsx` - Call for Side Events 和 Speakers

**当前追踪**: 使用 `Lead` 事件 + 自定义事件

**建议改进**: 
- 在用户点击申请表单链接时，同时追踪 `SubmitApplication` 事件
- 保留 `Lead` 事件作为补充（因为申请也可以被视为潜在客户线索）

**推荐参数**:
```javascript
trackEvent('SubmitApplication', {
  content_name: 'Call for Speakers', // 或其他申请类型
  content_category: 'Application',
  content_ids: ['speakers'], // 或其他标识符
});
```

---

### 2. FindLocation（查找位置）

**状态**: ⚠️ **部分实现**

**说明**: 网站有地图功能（AccommodationSection），用户可能会在地图上查找位置。由于地图是嵌入的 Google Maps iframe，我们无法直接追踪用户在地图内的交互。但可以追踪用户查看地图的行为。

**适用场景**:
- 用户查看 Accommodation Section 中的地图
- 用户点击地图上的位置标记（如果可能）
- 用户点击"查看网站"链接查看住宿详情

**当前实现位置**:
- `components/sections/AccommodationSection.tsx` - 地图展示
- `components/NomadMap.tsx` - 地图组件

**当前追踪**: 使用 `ViewContent` 事件（通过 `useSectionTracking`）

**建议改进**:
- 在用户首次查看地图时，追踪 `FindLocation` 事件
- 在用户点击住宿项目的"查看网站"链接时，追踪 `FindLocation` 事件

**推荐参数**:
```javascript
trackEvent('FindLocation', {
  content_name: 'Accommodation Map',
  content_category: 'Location Search',
  // 如果用户点击了特定住宿，可以添加：
  // content_ids: [accommodationId],
});
```

---

### 3. Schedule（安排/查看日程）

**状态**: ⚠️ **部分实现**

**说明**: 网站有日程表功能，用户可能会查看或安排活动。虽然目前使用了 `ViewContent` 和 `Search`，但如果用户实际安排/注册活动，应该使用 `Schedule` 事件。

**适用场景**:
- 用户打开日程表模态框
- 用户点击活动链接进行注册
- 用户筛选日程表（已有 `Search` 事件）

**当前实现位置**:
- `components/sections/EventsSection.tsx` - 日程表展示
- `components/ScheduleModal.tsx` - 日程表模态框
- `components/sections/SideEventCalendarSection.tsx` - 侧活动日历

**当前追踪**: 
- `ViewContent` 事件（通过 `useSectionTracking`）
- `Search` 事件（日程筛选）

**建议改进**:
- 在用户打开日程表模态框时，追踪 `Schedule` 事件
- 在用户点击活动链接进行注册时，追踪 `Schedule` 事件

**推荐参数**:
```javascript
trackEvent('Schedule', {
  content_name: 'Event Schedule',
  content_category: 'Event Registration',
  content_ids: [eventId], // 如果点击了特定活动
});
```

---

## 已正确实现的标准事件

以下事件已经正确实现，无需修改：

✅ **PageView** - 页面浏览
✅ **ViewContent** - 内容查看
✅ **CompleteRegistration** - 完成注册（订阅）
✅ **InitiateCheckout** - 开始结账
✅ **AddPaymentInfo** - 添加支付信息
✅ **Purchase** - 购买完成
✅ **Lead** - 潜在客户线索
✅ **Search** - 搜索/筛选
✅ **Contact** - 联系

---

## 实施建议

### 优先级 1: SubmitApplication（高优先级）

**原因**: 申请表单是重要的转化目标，使用标准事件可以更好地在 Meta 广告平台中创建转化目标。

**实施步骤**:
1. 在所有"Call for"链接的 `onClick` 事件中添加 `SubmitApplication` 追踪
2. 保留现有的 `Lead` 事件作为补充
3. 更新 `META_EVENTS_TRACKING.md` 文档

**影响文件**:
- `components/sections/HeroSection.tsx`
- `components/Footer.tsx`
- `components/sections/EventsSection.tsx`

### 优先级 2: FindLocation（中优先级）

**原因**: 地图功能是用户查找住宿的重要工具，追踪此事件有助于了解用户对位置的兴趣。

**实施步骤**:
1. 在 `AccommodationSection` 中，当用户首次查看地图时追踪 `FindLocation`
2. 在用户点击住宿项目的"查看网站"链接时追踪 `FindLocation`
3. 由于地图是 iframe，无法追踪地图内的交互，但可以追踪查看行为

**影响文件**:
- `components/sections/AccommodationSection.tsx`

### 优先级 3: Schedule（中优先级）

**原因**: 日程表是活动网站的核心功能，追踪此事件有助于了解用户对活动的参与度。

**实施步骤**:
1. 在用户打开日程表模态框时追踪 `Schedule`
2. 在用户点击活动链接进行注册时追踪 `Schedule`
3. 保留现有的 `ViewContent` 和 `Search` 事件

**影响文件**:
- `components/sections/EventsSection.tsx`
- `components/ScheduleModal.tsx`
- `components/sections/SideEventCalendarSection.tsx`

---

## 注意事项

1. **事件重复**: 某些场景可能同时触发多个事件（如 `SubmitApplication` 和 `Lead`），这是可以接受的，因为它们追踪不同的用户意图。

2. **iframe 限制**: 由于地图是嵌入的 Google Maps iframe，我们无法追踪用户在地图内的详细交互。只能追踪用户查看地图的行为。

3. **外部链接**: 申请表单链接指向外部 Google Forms，我们只能追踪用户点击链接的行为，无法追踪用户实际提交表单的行为（除非使用 Google Forms API）。

4. **向后兼容**: 添加新事件时，应保留现有的自定义事件追踪，以确保数据连续性。

---

## 总结

- **遗漏事件数量**: 3 个标准事件
- **高优先级**: 1 个（SubmitApplication）
- **中优先级**: 2 个（FindLocation, Schedule）
- **低优先级**: 0 个

建议优先实施 `SubmitApplication` 事件，因为它与重要的转化目标（申请表单）直接相关，可以更好地优化 Meta 广告投放。
