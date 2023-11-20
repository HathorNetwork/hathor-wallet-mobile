import { StyleSheet, View, Text } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import HathorHeader from '../../components/HathorHeader';
import { NC_BLUEPRINTS_MAP } from '../../constants';
import NewHathorButton from '../../components/NewHathorButton';
import { NanoContractSwapInitializeNav } from './NanoContractInitialize';

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
  infoCell: {
    marginVertical: 8,
  },
  cellTitle: {
    fontWeight: 'bold',
  },
  buttonContainer: {
    alignSelf: 'stretch',
    marginTop: 'auto'
  },
});

export const NanoContractBlueprintNav = Symbol('NanoContractBlueprint').toString();

export const NanoContractBlueprint = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { title, blueprintId } = route.params;

  const blueprintMetadata = NC_BLUEPRINTS_MAP[blueprintId];
  const blueprintName = blueprintMetadata.name;
  const blueprintAttributes = Object.entries(blueprintMetadata.attributes);
  const blueprintPublicMethods = Object.entries(blueprintMetadata.public_methods);
  const blueprintPrivateMethods = Object.entries(blueprintMetadata.private_methods);

  return (
    <View style={styles.container}>
      <HathorHeader
        title={title.toUpperCase()}
        onBackPress={() => navigation.goBack()}
      />
      <View style={styles.content}>
        <View style={styles.infoCell}>
          <Text style={styles.cellTitle}>Name</Text>
          <Text>{blueprintName}</Text>
        </View>
        <View style={styles.infoCell}>
          <Text style={styles.cellTitle}>Attributes</Text>
          {blueprintAttributes.map(([key, value]) => (<Text>- {key}: {value}</Text>))}
        </View>
        <View style={styles.infoCell}>
          <Text style={styles.cellTitle}>Public Methods</Text>
          {blueprintPublicMethods.map(([key, value]) => (
            <View>
              <Text>- {key}: {value.return_type}</Text>
              {!!value.args.length && (
                <View>
                  <Text>  - Args:</Text>
                  {value.args.map(({name, type}) => (<Text>    - {name}: {type}</Text>))}
                </View>
              )}
            </View>
          ))}
        </View>
        <View style={styles.infoCell}>
          <Text style={styles.cellTitle}>Private Methods</Text>
          {blueprintPrivateMethods.map(([key, value]) => (
            <View>
              <Text>- {key}: {value.return_type}</Text>
              {!!value.args.length && (
                <View>
                  <Text>  - Args:</Text>
                  {value.args.map(({name, type}) => (<Text>    - {name}: {type}</Text>))}
                </View>
              )}
            </View>
          ))}
        </View>
        <View style={styles.buttonContainer}>
          <NewHathorButton
            onPress={() => navigation.push(NanoContractSwapInitializeNav, { title: blueprintName, blueprintId })}
            title={'Init'}
          />
        </View>
      </View>
    </View>
  );
};
