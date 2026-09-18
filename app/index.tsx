import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  Button,
  Chip,
  Input,
  Label,
  Muted,
  PackTile,
  Screen,
  Subtitle,
} from '@/src/components/ui';
import { countCombinedDeck, getBannedCount, getPlayablePackMeta } from '@/src/engine/deck';
import {
  SOLO_DEFAULT_TARGET,
  type GameMode,
  type JudgeMode,
} from '@/src/engine/types';
import { useGameStore } from '@/src/store/GameContext';
import {
  claimSeat,
  getMySeat,
  joinRoom,
  listOpenRooms,
  pullRoom,
  pushRoom,
  setMySeat,
  setOnlineFlag,
  type OpenRoomRow,
} from '@/src/store/roomSync';
import { randomNickname } from '@/src/engine/nicknames';
import * as Engine from '@/src/engine/game';
import { useTheme } from '@/src/store/ThemeContext';
import { ThemeToggle } from '@/src/components/ThemeToggle';
import { APP_VERSION_LABEL } from '@/src/version';
