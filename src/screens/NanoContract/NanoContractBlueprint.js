import { StyleSheet, View, Text } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import HathorHeader from '../../components/HathorHeader';
import { NC_BLUEPRINTS_MAP } from '../../constants';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'flex-start',
    padding: 16,
    paddingBottom: 48,
  },
});

export const NanoContractBlueprintNav = Symbol('NanoContractBlueprint').toString();

export const NanoContractBlueprint = () => {
  const route = useRoute();
  const navigation = useNavigation();

  const { title, blueprintId } = route.params;
  return (
    <View style={styles.container}>
      <HathorHeader
        title={title.toUpperCase()}
        onBackPress={() => navigation.goBack()}
      />
      <View style={styles.content}>
        <Text>{JSON.stringify(NC_BLUEPRINTS_MAP[blueprintId])}</Text>
      </View>
    </View>
  );
};
