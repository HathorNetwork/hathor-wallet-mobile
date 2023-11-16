import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { TouchableHighlight } from 'react-native-gesture-handler';
import { useNavigation } from '@react-navigation/native';
import HathorHeader from '../../components/HathorHeader';
import { NanoContractBlueprintNav } from './NanoContractBlueprint';
import { NC_BLUEPRINT_SWAP_ID } from '../../constants';

const nanoContractSelectorTitleText = 'Blueprints'.toUpperCase();

const blueprintSwapTitleText = 'Swap';
const blueprintSwapBodyText = 'Swap token A for token B on a predefined ratio.';

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
  card: {
    padding: 16,
    marginBottom: 16,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 5,
    backgroundColor: 'white',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  cardBody: {
    marginTop: 10,
    // Gray
    color: 'hsl(0, 0%, 55%)',
  },
});

export const NanoContractSelectorNav = Symbol('NanoContractSelector').toString();

export const NanoContractSelector = () => {
  const navigation = useNavigation();
  return (
    <View style={styles.container}>
      <HathorHeader
        title={nanoContractSelectorTitleText}
        onBackPress={() => navigation.goBack()}
      />
      <View style={styles.content}>
        <BlueprintCard title={blueprintSwapTitleText} body={blueprintSwapBodyText} blueprintId={NC_BLUEPRINT_SWAP_ID} />
      </View>
    </View>
  );
};

const BlueprintCard = ({ title, body, blueprintId }) => {
  const navigation = useNavigation();
  const handleBlueprintInfoPress = (blueprintId) => () => {
    navigation.push(NanoContractBlueprintNav, {title, blueprintId});
  };

  return (
    <TouchableHighlight
      onPress={handleBlueprintInfoPress(blueprintId)}
      underlayColor='hsl(0, 0%, 98%)'
      style={styles.card}
    >
      <View>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardBody}>{body}</Text>
      </View>
    </TouchableHighlight>
  );
};
