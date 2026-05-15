# 피드백 원장 (Claude가 누적 관리)

**후기 1차 소스 = GitHub Issues (`label:review`)**
사용자가 홈 후기란 작성 → "사이트에 후기 등록" → 내용이 채워진 GitHub
이슈 등록 화면에서 Submit. (보조: "텍스트 복사" → 채팅 붙여넣기)

Claude는 **매 회차 1단계 전에**
`https://github.com/viennaru-prg/viennaru-prg.github.io/issues?q=label:review`
를 WebFetch로 읽어 새 후기를 확인하고, 아래에 시간순으로 누적한 뒤
취향 패턴을 반영한다. (채팅으로 받은 후기도 동일하게 누적)

형식:
```
## [YYYY-MM-DD] 프로젝트 N · 별점 X/5
원문: <사용자가 쓴 그대로>
해석/패턴: <Claude가 뽑아낸 선호·회피 신호>
다음에 반영: <구체적 조치>
```

---

<!-- 후기를 받을 때마다 위 형식으로 아래에 추가 -->

(아직 누적된 후기 없음)
