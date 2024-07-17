import { StyleSheet } from 'react-native';
import { COLORS } from '../../styles/themes';

export const commonStyles = StyleSheet.create({
  // Card
  card: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: COLORS.backgroundColor,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    shadowOffset: { height: 2, width: 0 },
    shadowRadius: 4,
    shadowColor: COLORS.textColor,
    shadowOpacity: 0.08,
  },
  cardSplit: {
    flexDirection: 'row',
    gap: 16,
  },
  cardSplitIcon: {
    flexShrink: 1,
    alignSelf: 'flex-start',
  },
  cardSplitContent: {
    maxWidth: '80%',
    flexDirection: 'column',
    gap: 8,
  },
  cardSeparator: {
    width: '100%',
    height: 1,
    backgroundColor: COLORS.borderColor
  },
  cardStack: {
    flexDirection: 'column',
  },
  cardStackItem: {
    flexDirection: 'row',
    paddingVertical: 16,
  },
  listItem: {
    paddingVertical: 24,
    paddingHorizontal: 16,
  },

  // General
  text: {
    fontSize: 14,
    lineHeight: 20,
    color: COLORS.black,
  },
  bold: {
    fontWeight: 'bold',
  },
  value: {
    color: 'hsla(0, 0%, 38%, 1)',
  },
  mb4: {
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    lineHeight: 20,
    color: COLORS.black,
    marginBottom: 24,
  },
});
